import Link from 'next/link'

import { formatCaseEventType } from '@/lib/case-events'
import { createServiceRoleSupabase } from '@/lib/supabase/server'
import { resolveWorkflow } from '@/lib/workflow/resolve-workflow'

import AutoRefresh from './auto-refresh'
import DisplayModeWrapper from './display-mode-wrapper'

const RECENT_COMPLETED_WINDOW_HOURS = 24

type CaseRow = {
  id: string
  case_number: string
  status: string | null
  created_at: string | null
  clinic_name: string | null
  pet_name: string | null
  cremation_type: string | null
  memorial_items: Array<{ item_id: string; item_name: string; qty: number }> | null
  pet_weight: string | number | null
  pet_weight_unit: string | null
  pet_weight_lbs: number | null
}

type CaseEventRow = {
  case_id: string
  event_type: string
  created_at: string
  created_by: string | null
  metadata?: {
    location?: string | null
  } | null
}

type WorkroomCase = {
  id: string
  caseNumber: string
  currentStep: string | null
  nextStep: string | null
  isComplete: boolean
  lastEventTime: string | null
  lastEventUser: string | null
  location: string | null
  weight: string | number | null
  weightLbs: number | null
  createdAt: string | null
  clinicName: string | null
  petName: string | null
  cremationType: string | null
  memorialItems: Array<{ item_id: string; item_name: string; qty: number }>
  terminalEventTime: string | null
  terminalEventUser: string | null
}

type SummaryCard = {
  label: string
  value: number
}

const sectionTitleClass = 'text-[clamp(1.5rem,1.1rem+1vw,2rem)] font-semibold text-slate-900'
const cardLabelClass =
  'text-[clamp(0.7rem,0.66rem+0.2vw,0.8rem)] font-medium uppercase tracking-wide text-slate-500'
const cardValueLargeClass = 'text-[clamp(1rem,0.9rem+0.45vw,1.2rem)] font-semibold'
const metadataValueClass = 'text-[clamp(0.82rem,0.78rem+0.16vw,0.9rem)] font-semibold text-slate-900'
const summaryValueClass = 'text-[clamp(1.2rem,0.9rem+1vw,1.8rem)] font-bold text-slate-900'
const columnCellClass = 'min-w-0'
const oneLineValueClass = 'overflow-hidden text-ellipsis whitespace-nowrap'
const oneLineMetadataClass = 'overflow-hidden text-ellipsis whitespace-nowrap'

function getCustodyAgeDays(createdAt: string | null) {
  if (!createdAt) return null

  const diffMs = Date.now() - new Date(createdAt).getTime()
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

// TODO: When 24-hour turnaround premium option is added to case data,
// force those pets to highest priority and red text immediately.
function getCustodyUrgencyTextClass(createdAt: string | null) {
  const custodyDays = getCustodyAgeDays(createdAt)

  if (custodyDays === null) return 'text-slate-900'
  if (custodyDays >= 5) return 'text-red-600'
  if (custodyDays >= 3) return 'text-yellow-600'
  return 'text-slate-900'
}

function getUrgencyRank(createdAt: string | null) {
  const days = getCustodyAgeDays(createdAt)

  if (days === null) return 3
  if (days >= 5) return 0
  if (days >= 3) return 1
  return 2
}

function getUrgencyLabel(createdAt: string | null) {
  const days = getCustodyAgeDays(createdAt)

  if (days === null) return null
  if (days >= 5) return { label: '5+ DAYS', color: 'red' as const }
  if (days >= 3) return { label: '3+ DAYS', color: 'yellow' as const }
  return null
}

function formatWeight(weight: string | number | null) {
  if (weight === null || weight === undefined || weight === '') {
    return '—'
  }

  if (typeof weight === 'number') {
    return `${weight} lbs`
  }

  const normalizedWeight = weight.trim()

  if (!normalizedWeight) {
    return '—'
  }

  const hasUnits = /[a-zA-Z]/.test(normalizedWeight)

  return hasUnits ? normalizedWeight : `${normalizedWeight} lbs`
}

function isGeneralPrintNeeded(caseItem: Pick<WorkroomCase, 'memorialItems'>) {
  return caseItem.memorialItems.some((item) => {
    const itemName = item.item_name?.trim().toLowerCase() ?? ''

    return (
      itemName.includes('clay paw print') ||
      itemName.includes('ink paw print') ||
      itemName.includes('nose print') ||
      itemName.includes('fur')
    )
  })
}

function isWithinRecentCompletedWindow(timestamp: string | null) {
  if (!timestamp) {
    return false
  }

  const diffMs = Date.now() - new Date(timestamp).getTime()

  return diffMs <= RECENT_COMPLETED_WINDOW_HOURS * 60 * 60 * 1000
}

function getCreatedAtTime(createdAt: string | null) {
  return createdAt ? new Date(createdAt).getTime() : Number.POSITIVE_INFINITY
}

function sortCasesByCreatedAt(a: WorkroomCase, b: WorkroomCase) {
  return getCreatedAtTime(a.createdAt) - getCreatedAtTime(b.createdAt)
}

async function findCompletionEvent(params: {
  caseId: string
  cremationType: 'private' | 'general'
  caseEvents: CaseEventRow[]
}) {
  for (let index = 0; index < params.caseEvents.length; index += 1) {
    const event = params.caseEvents[index]
    const workflowAtEvent = await resolveWorkflow({
      caseId: params.caseId,
      cremationType: params.cremationType,
      events: params.caseEvents.slice(0, index + 1).map((caseEvent) => ({
        event_type: caseEvent.event_type,
        created_at: caseEvent.created_at,
      })),
    })

    if (workflowAtEvent.isComplete) {
      return event
    }
  }

  return null
}

function SummaryRow({ cards }: { cards: SummaryCard[] }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm"
        >
          <div className={cardLabelClass}>{card.label}</div>
          <div className={`mt-1 ${summaryValueClass}`}>{card.value}</div>
        </div>
      ))}
    </section>
  )
}

function PrivateBoardSection({ cases }: { cases: WorkroomCase[] }) {
  return (
    <section className="rounded-[28px] bg-white p-6 shadow-sm group-data-[display-mode=on]/workroom:p-8">
      <div className="flex items-center justify-between gap-3">
        <h2 className={sectionTitleClass}>{`Privates (${cases.length})`}</h2>
        <div className="text-sm text-slate-500">One prioritized operational list</div>
      </div>

      <div className="mt-4 space-y-3 group-data-[display-mode=on]/workroom:mt-6 group-data-[display-mode=on]/workroom:space-y-4">
        {cases.length > 0 ? (
          cases.map((caseItem) => {
            const urgency = getUrgencyLabel(caseItem.createdAt)
            const textClass = getCustodyUrgencyTextClass(caseItem.createdAt)
            const custodyAgeDays = getCustodyAgeDays(caseItem.createdAt)

            return (
              <div
                key={caseItem.id}
                className="rounded-2xl border border-slate-200 px-4 py-3"
              >
                <div className="grid gap-3 md:grid-cols-9">
                  <div className={columnCellClass}>
                    {urgency ? (
                      <div
                        className={`mb-2 inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                          urgency.color === 'red'
                            ? 'bg-red-600 text-white'
                            : 'bg-yellow-400 text-black'
                        }`}
                      >
                        {urgency.label}
                      </div>
                    ) : null}
                    <div className={cardLabelClass}>Case Number</div>
                    <div className={`${cardValueLargeClass} ${textClass} ${oneLineValueClass}`}>
                      {caseItem.caseNumber}
                    </div>
                  </div>
                  <div className={columnCellClass}>
                    <div className={cardLabelClass}>Days in Custody</div>
                    <div className={`${metadataValueClass} ${textClass} ${oneLineMetadataClass}`}>
                      {custodyAgeDays === null ? '—' : `${custodyAgeDays} days`}
                    </div>
                  </div>
                  <div className={columnCellClass}>
                    <div className={cardLabelClass}>Current Location</div>
                    <div className={`${cardValueLargeClass} text-slate-900 ${oneLineValueClass}`}>
                      {caseItem.location || 'Unassigned'}
                    </div>
                  </div>
                  <div className={columnCellClass}>
                    <div className={cardLabelClass}>Pet Name</div>
                    <div className={`${cardValueLargeClass} text-slate-900 ${oneLineValueClass}`}>
                      {caseItem.petName || '—'}
                    </div>
                  </div>
                  <div className={columnCellClass}>
                    <div className={cardLabelClass}>Current Step</div>
                    <div className={`${cardValueLargeClass} ${textClass} ${oneLineValueClass}`}>
                      {caseItem.currentStep
                        ? formatCaseEventType(caseItem.currentStep)
                        : '—'}
                    </div>
                  </div>
                  <div className={columnCellClass}>
                    <div className={cardLabelClass}>Next Required Step</div>
                    <div className={`${cardValueLargeClass} ${textClass} ${oneLineValueClass}`}>
                      {caseItem.nextStep
                        ? formatCaseEventType(caseItem.nextStep)
                        : '—'}
                    </div>
                  </div>
                  <div className={columnCellClass}>
                    <div className={cardLabelClass}>Clinic</div>
                    <div className={`${metadataValueClass} ${oneLineMetadataClass}`}>
                      {caseItem.clinicName || '—'}
                    </div>
                  </div>
                  <div className={columnCellClass}>
                    <div className={cardLabelClass}>Last Handled By</div>
                    <div className={`${metadataValueClass} ${oneLineMetadataClass}`}>
                      {caseItem.lastEventUser || 'Unassigned'}
                    </div>
                  </div>
                  <div className={columnCellClass}>
                    <div className={cardLabelClass}>Last Updated</div>
                    <div className={`${metadataValueClass} ${oneLineMetadataClass}`}>
                      {caseItem.lastEventTime
                        ? new Date(caseItem.lastEventTime).toLocaleString()
                        : '—'}
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        ) : (
          <div className="rounded-2xl border border-slate-200 px-4 py-3 text-slate-600">
            No active private cases.
          </div>
        )}
      </div>
    </section>
  )
}

function GeneralBoardSection({
  cases,
  totalWeightLbs,
}: {
  cases: WorkroomCase[]
  totalWeightLbs: number
}) {
  return (
    <section className="rounded-[28px] bg-white p-6 shadow-sm group-data-[display-mode=on]/workroom:p-8">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className={sectionTitleClass}>{`Generals (${cases.length})`}</h2>
          <div className="text-sm text-slate-500">
            {`Total Weight to be Cremated: ${totalWeightLbs} lbs`}
          </div>
        </div>
        <div className="text-sm text-slate-500">One prioritized communal operations list</div>
      </div>

      <div className="mt-4 space-y-3 group-data-[display-mode=on]/workroom:mt-6 group-data-[display-mode=on]/workroom:space-y-4">
        {cases.length > 0 ? (
          cases.map((caseItem) => {
            const urgency = getUrgencyLabel(caseItem.createdAt)
            const custodyTextClass = getCustodyUrgencyTextClass(caseItem.createdAt)
            const printsNeeded = isGeneralPrintNeeded(caseItem)
            const textClass = printsNeeded ? 'text-yellow-600' : custodyTextClass
            const custodyAgeDays = getCustodyAgeDays(caseItem.createdAt)

            return (
              <div
                key={caseItem.id}
                className="rounded-2xl border border-slate-200 px-4 py-3"
              >
                <div className="grid gap-3 md:grid-cols-10">
                  <div className={columnCellClass}>
                    {urgency ? (
                      <div
                        className={`mb-2 inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                          urgency.color === 'red'
                            ? 'bg-red-600 text-white'
                            : 'bg-yellow-400 text-black'
                        }`}
                      >
                        {urgency.label}
                      </div>
                    ) : null}
                    <div className={cardLabelClass}>Case Number</div>
                    <div className={`${cardValueLargeClass} ${textClass} ${oneLineValueClass}`}>
                      {caseItem.caseNumber}
                    </div>
                  </div>
                  <div className={columnCellClass}>
                    <div className={cardLabelClass}>Days in Custody</div>
                    <div className={`${metadataValueClass} ${textClass} ${oneLineMetadataClass}`}>
                      {custodyAgeDays === null ? '—' : `${custodyAgeDays} days`}
                    </div>
                  </div>
                  <div className={columnCellClass}>
                    <div className={cardLabelClass}>Current Location</div>
                    <div className={`${cardValueLargeClass} ${textClass} ${oneLineValueClass}`}>
                      {caseItem.location || 'Unassigned'}
                    </div>
                  </div>
                  <div className={columnCellClass}>
                    <div className={cardLabelClass}>Pet Name</div>
                    <div className={`${cardValueLargeClass} text-slate-900 ${oneLineValueClass}`}>
                      {caseItem.petName || '—'}
                    </div>
                  </div>
                  <div className={columnCellClass}>
                    <div className={cardLabelClass}>Next Workflow Step</div>
                    <div className={`${cardValueLargeClass} ${textClass} ${oneLineValueClass}`}>
                      {caseItem.nextStep
                        ? formatCaseEventType(caseItem.nextStep)
                        : '—'}
                    </div>
                  </div>
                  <div className={columnCellClass}>
                    <div className={cardLabelClass}>Clinic</div>
                    <div className={`${metadataValueClass} ${oneLineMetadataClass}`}>
                      {caseItem.clinicName || '—'}
                    </div>
                  </div>
                  <div className={columnCellClass}>
                    <div className={cardLabelClass}>Last Handled By</div>
                    <div className={`${metadataValueClass} ${oneLineMetadataClass}`}>
                      {caseItem.lastEventUser || 'Unassigned'}
                    </div>
                  </div>
                  <div className={columnCellClass}>
                    <div className={cardLabelClass}>Last Updated</div>
                    <div className={`${metadataValueClass} ${oneLineMetadataClass}`}>
                      {caseItem.lastEventTime
                        ? new Date(caseItem.lastEventTime).toLocaleString()
                        : '—'}
                    </div>
                  </div>
                  <div className={columnCellClass}>
                    <div className={cardLabelClass}>Case Weight</div>
                    <div className={`${cardValueLargeClass} ${textClass} ${oneLineValueClass}`}>
                      {formatWeight(caseItem.weight)}
                    </div>
                  </div>
                  <div className={columnCellClass}>
                    <div className={cardLabelClass}>Prints Needed</div>
                    <div className={`${metadataValueClass} ${textClass} ${oneLineMetadataClass}`}>
                      {printsNeeded ? 'Yes' : 'No'}
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        ) : (
          <div className="rounded-2xl border border-slate-200 px-4 py-3 text-slate-600">
            No active general or communal cases.
          </div>
        )}
      </div>
    </section>
  )
}

function RecentCompletedSection({
  cases,
}: {
  cases: WorkroomCase[]
}) {
  if (cases.length === 0) {
    return null
  }

  return (
    <section className="rounded-[28px] bg-white p-6 shadow-sm group-data-[display-mode=on]/workroom:p-8">
      <h2 className={sectionTitleClass}>{`Recent Completed (${cases.length})`}</h2>
      <div className="mt-4 space-y-3 group-data-[display-mode=on]/workroom:mt-6 group-data-[display-mode=on]/workroom:space-y-4">
        {cases.map((caseItem) => {
          const terminalBadgeClasses = 'bg-slate-900 text-white'

          return (
            <div
              key={`${caseItem.id}-recent-completed`}
              className="rounded-2xl border border-slate-200 px-4 py-3"
            >
              <div className="grid gap-3 md:grid-cols-8">
                <div className={columnCellClass}>
                  <div className={cardLabelClass}>Case Number</div>
                  <div className={`${cardValueLargeClass} text-slate-900 ${oneLineValueClass}`}>
                    {caseItem.caseNumber}
                  </div>
                </div>
                <div className={columnCellClass}>
                  <div className={cardLabelClass}>Pet Name</div>
                  <div className={`${cardValueLargeClass} text-slate-900 ${oneLineValueClass}`}>
                    {caseItem.petName || '—'}
                  </div>
                </div>
                <div className={columnCellClass}>
                  <div className={cardLabelClass}>Clinic</div>
                  <div className={`${metadataValueClass} ${oneLineMetadataClass}`}>
                    {caseItem.clinicName || '—'}
                  </div>
                </div>
                <div className={columnCellClass}>
                  <div className={cardLabelClass}>Completed At</div>
                  <div className={`${metadataValueClass} ${oneLineMetadataClass}`}>
                    {caseItem.terminalEventTime
                      ? new Date(caseItem.terminalEventTime).toLocaleString()
                      : '—'}
                  </div>
                </div>
                <div className={columnCellClass}>
                  <div className={cardLabelClass}>Completed By</div>
                  <div className={`${metadataValueClass} ${oneLineMetadataClass}`}>
                    {caseItem.terminalEventUser || 'Unassigned'}
                  </div>
                </div>
                <div className={columnCellClass}>
                  <div className={cardLabelClass}>Cremation Type</div>
                  <div className={`${metadataValueClass} ${oneLineMetadataClass}`}>
                    {caseItem.cremationType || '—'}
                  </div>
                </div>
                <div className={columnCellClass}>
                  <div className={cardLabelClass}>Terminal</div>
                  <div className="mt-1">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${terminalBadgeClasses}`}
                    >
                      Completed
                    </span>
                  </div>
                </div>
                <div className="flex items-end">
                  <Link
                    href={`/cases/${caseItem.id}`}
                    className="rounded border px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                  >
                    View Case
                  </Link>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export default async function WorkroomPage() {
  const supabase = createServiceRoleSupabase()

  const { data: cases, error: casesError } = await supabase
    .from('cases')
    .select(
      'id, case_number, status, created_at, clinic_name, pet_name, cremation_type, memorial_items, pet_weight, pet_weight_unit, pet_weight_lbs'
    )
    .neq('status', 'cancelled')
    .order('created_at', { ascending: true })

  if (casesError) {
    throw new Error(casesError.message)
  }

  const caseItems = (cases as CaseRow[] | null) ?? []
  const caseIds = caseItems.map((caseItem) => caseItem.id)

  let eventsByCaseId = new Map<string, CaseEventRow[]>()
  let userDisplayById = new Map<string, string>()

  if (caseIds.length > 0) {
    const [{ data: caseEvents, error: caseEventsError }, usersResponse] = await Promise.all([
      supabase
        .from('case_events')
        .select('case_id, event_type, created_at, created_by, metadata')
        .in('case_id', caseIds)
        .order('created_at', { ascending: true }),
      supabase.auth.admin.listUsers(),
    ])

    if (caseEventsError) {
      throw new Error(caseEventsError.message)
    }

    if (usersResponse.error) {
      throw new Error(usersResponse.error.message)
    }

    const groupedEventsByCaseId = new Map<string, CaseEventRow[]>(
      caseIds.map((caseId) => [caseId, []])
    )

    for (const event of ((caseEvents as CaseEventRow[] | null) ?? [])) {
      const caseEventsForCase = groupedEventsByCaseId.get(event.case_id)

      if (caseEventsForCase) {
        caseEventsForCase.push(event)
      }
    }

    eventsByCaseId = groupedEventsByCaseId

    userDisplayById = new Map(
      (usersResponse.data.users ?? []).map((user) => {
        const metadata = user.user_metadata ?? {}
        const displayName =
          (typeof metadata.full_name === 'string' && metadata.full_name.trim()) ||
          (typeof metadata.name === 'string' && metadata.name.trim()) ||
          user.email ||
          user.id

        return [user.id, displayName]
      })
    )
  }

  const workroomCases: WorkroomCase[] = await Promise.all(caseItems.map(async (caseItem) => {
    const caseEvents = eventsByCaseId.get(caseItem.id) ?? []
    const latestEvent = caseEvents[caseEvents.length - 1]
    const cremationType = caseItem.cremation_type === 'general' ? 'general' : 'private'
    const workflow = await resolveWorkflow({
      caseId: caseItem.id,
      cremationType,
      events: caseEvents.map((event) => ({
        event_type: event.event_type,
        created_at: event.created_at,
      })),
    })
    const completionEvent = workflow.isComplete
      ? await findCompletionEvent({
          caseId: caseItem.id,
          cremationType,
          caseEvents,
        })
      : null

    return {
      id: caseItem.id,
      caseNumber: caseItem.case_number,
      currentStep: workflow.currentStep,
      nextStep: workflow.nextStep,
      isComplete: workflow.isComplete,
      lastEventTime: latestEvent?.created_at ?? null,
      lastEventUser: latestEvent?.created_by
        ? userDisplayById.get(latestEvent.created_by) ?? latestEvent.created_by
        : null,
      location: latestEvent?.metadata?.location ?? null,
      weight:
        caseItem.pet_weight && caseItem.pet_weight_unit
          ? `${caseItem.pet_weight} ${caseItem.pet_weight_unit}`
          : caseItem.pet_weight_lbs ?? caseItem.pet_weight ?? null,
      weightLbs: caseItem.pet_weight_lbs ?? null,
      createdAt: caseItem.created_at,
      clinicName: caseItem.clinic_name,
      petName: caseItem.pet_name,
      cremationType: caseItem.cremation_type,
      memorialItems: caseItem.memorial_items ?? [],
      terminalEventTime: completionEvent?.created_at ?? null,
      terminalEventUser:
        completionEvent?.created_by
          ? userDisplayById.get(completionEvent.created_by) ?? completionEvent.created_by
          : null,
    }
  }))

  const recentCompletedCases = workroomCases
    .filter((caseItem) => caseItem.isComplete)
    .filter((caseItem) => isWithinRecentCompletedWindow(caseItem.terminalEventTime))
    .sort((a, b) => {
      const aTime = a.terminalEventTime ? new Date(a.terminalEventTime).getTime() : 0
      const bTime = b.terminalEventTime ? new Date(b.terminalEventTime).getTime() : 0

      return bTime - aTime
    })

  const activeWorkroomCases = workroomCases
    .filter((caseItem) => !caseItem.isComplete)
    .sort(sortCasesByCreatedAt)
  const privateCases = activeWorkroomCases.filter(
    (caseItem) => caseItem.cremationType !== 'general'
  )
  const orderedPrivateCases = [...privateCases].sort((a, b) => {
    const aHasNextStep = a.nextStep !== null
    const bHasNextStep = b.nextStep !== null

    if (aHasNextStep !== bHasNextStep) {
      return aHasNextStep ? -1 : 1
    }

    const createdAtDifference = getCreatedAtTime(a.createdAt) - getCreatedAtTime(b.createdAt)

    if (createdAtDifference !== 0) {
      return createdAtDifference
    }

    return a.caseNumber.localeCompare(b.caseNumber)
  })
  const generalCases = activeWorkroomCases.filter(
    (caseItem) => caseItem.cremationType === 'general'
  )

  const overdueCount = activeWorkroomCases.filter((caseItem) => {
    const days = getCustodyAgeDays(caseItem.createdAt)
    return days !== null && days >= 5
  }).length

  const totalGeneralWeightLbs = generalCases.reduce((total, caseItem) => {
    return typeof caseItem.weightLbs === 'number' && Number.isFinite(caseItem.weightLbs)
      ? total + caseItem.weightLbs
      : total
  }, 0)

  const summaryCards: SummaryCard[] = [
    { label: 'Active Privates', value: privateCases.length },
    { label: 'Active Generals', value: generalCases.length },
    { label: 'Overdue', value: overdueCount },
    { label: 'Active Workflow', value: activeWorkroomCases.length },
    { label: 'Recent Completed', value: recentCompletedCases.length },
  ]

  return (
    <DisplayModeWrapper
      title="Workroom"
      description="Internal Horizon dashboard for current work and pet location handoff."
    >
      <AutoRefresh />
      <SummaryRow cards={summaryCards} />
      <PrivateBoardSection cases={orderedPrivateCases} />
      <GeneralBoardSection
        cases={generalCases}
        totalWeightLbs={totalGeneralWeightLbs}
      />
      <RecentCompletedSection cases={recentCompletedCases} />
    </DisplayModeWrapper>
  )
}
