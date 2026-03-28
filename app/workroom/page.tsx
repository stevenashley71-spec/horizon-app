import { formatCaseEventType } from '@/lib/case-events'
import {
  getCurrentWorkflowStep,
  getNextAllowedEventType,
} from '@/lib/case-workflow'
import { createServerSupabase } from '@/lib/supabase/server'

import AutoRefresh from './auto-refresh'
import DisplayModeWrapper from './display-mode-wrapper'

type CaseRow = {
  id: string
  case_number: string
  status: string | null
  created_at: string | null
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
  currentWorkflowStep: string | null
  nextRequiredEvent: string | null
  lastEventTime: string | null
  lastEventUser: string | null
  location: string | null
  weight: string | number | null
  weightLbs: number | null
  createdAt: string | null
  cremationType: string | null
  memorialItems: Array<{ item_id: string; item_name: string; qty: number }>
}

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

function isGeneralCase(caseItem: WorkroomCase) {
  const cremationType = caseItem.cremationType?.trim().toLowerCase()

  return cremationType === 'general' || cremationType === 'communal'
}

function isGeneralPrintNeeded(caseItem: WorkroomCase) {
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

function WorkroomLegend({ displayMode = false }: { displayMode?: boolean }) {
  const titleClass = displayMode ? 'text-3xl md:text-4xl' : 'text-2xl'
  const itemTitleClass = displayMode ? 'text-base md:text-lg' : 'text-sm'
  const itemTextClass = displayMode ? 'text-sm md:text-base' : 'text-sm'

  return (
    <section className={`rounded-[28px] bg-white shadow-sm ${displayMode ? 'p-10' : 'p-8'}`}>
      <h2 className={`${titleClass} font-semibold text-slate-900`}>Legend</h2>
      <div className={`mt-6 grid gap-4 md:grid-cols-2 ${displayMode ? 'md:gap-6' : ''}`}>
        <div className="rounded-2xl border border-slate-200 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex rounded-full bg-red-600 px-2 py-1 text-xs font-semibold text-white">
              5+ DAYS
            </span>
            <div className={`${itemTitleClass} font-semibold text-red-600`}>
              Red text / red badge
            </div>
          </div>
          <div className={`mt-2 text-slate-500 ${itemTextClass}`}>
            5+ days in custody, highest urgency
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex rounded-full bg-yellow-400 px-2 py-1 text-xs font-semibold text-black">
              3+ DAYS
            </span>
            <div className={`${itemTitleClass} font-semibold text-yellow-600`}>
              Yellow text / yellow badge
            </div>
          </div>
          <div className={`mt-2 text-slate-500 ${itemTextClass}`}>
            3+ days in custody, urgent
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 px-4 py-3">
          <div className={`${itemTitleClass} font-semibold text-slate-900`}>
            Ready for Cremation section
          </div>
          <div className={`mt-2 text-slate-500 ${itemTextClass}`}>
            Top operational priority
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 px-4 py-3">
          <div className={`${itemTitleClass} font-semibold text-slate-900`}>
            Cooler - Work Required
          </div>
          <div className={`mt-2 text-slate-500 ${itemTextClass}`}>
            Memorial work still needed
          </div>
        </div>
      </div>
    </section>
  )
}

function GeneralsSection({
  cases,
  totalWeightLbs,
  communalLoadReady,
  communalReadyWeight,
  scatteringReady,
  scatteringReadyWeight,
  displayMode = false,
}: {
  cases: WorkroomCase[]
  totalWeightLbs: number
  communalLoadReady: WorkroomCase[]
  communalReadyWeight: number
  scatteringReady: WorkroomCase[]
  scatteringReadyWeight: number
  displayMode?: boolean
}) {
  const titleClass = displayMode ? 'text-3xl md:text-4xl' : 'text-2xl'
  const valueClass = displayMode ? 'text-2xl md:text-3xl' : 'text-lg'

  return (
    <section className={`rounded-[28px] bg-white shadow-sm ${displayMode ? 'p-10' : 'p-8'}`}>
      <h2 className={`${titleClass} font-semibold text-slate-900`}>
        {`Generals (${cases.length}) • Total Weight: ${totalWeightLbs} lbs`}
      </h2>
      <div className={displayMode ? 'mt-8 space-y-6' : 'mt-6 space-y-4'}>
        <div className="rounded-2xl border border-slate-200 px-5 py-4">
          <h3 className={`${displayMode ? 'text-2xl md:text-3xl' : 'text-xl'} font-semibold text-slate-900`}>
            {`Communal Load Ready (${communalLoadReady.length}) • ${communalReadyWeight} lbs`}
          </h3>
          <div className={displayMode ? 'mt-6 space-y-4' : 'mt-4 space-y-3'}>
            {communalLoadReady.length > 0 ? (
              communalLoadReady.map((caseItem) => {
                const custodyAgeDays = getCustodyAgeDays(caseItem.createdAt)

                return (
                  <div
                    key={`${caseItem.id}-communal-ready`}
                    className="rounded-2xl border border-slate-200 px-5 py-4"
                  >
                    <div className="grid gap-4 md:grid-cols-4">
                      <div>
                        <div className="text-sm font-medium text-slate-500">Case Number</div>
                        <div className={`${valueClass} font-semibold text-slate-900`}>
                          {caseItem.caseNumber}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-slate-500">Weight</div>
                        <div className={`${valueClass} font-semibold text-slate-900`}>
                          {formatWeight(caseItem.weight)}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-slate-500">Current Location</div>
                        <div className={`${valueClass} font-semibold text-slate-900`}>
                          {caseItem.location || 'Unassigned'}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-slate-500">Days in Custody</div>
                        <div className={`${valueClass} font-semibold text-slate-900`}>
                          {custodyAgeDays === null ? '—' : `${custodyAgeDays} days`}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="rounded-2xl border border-slate-200 px-5 py-4 text-slate-600">
                No cases in this section.
              </div>
            )}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 px-5 py-4">
          <h3 className={`${displayMode ? 'text-2xl md:text-3xl' : 'text-xl'} font-semibold text-slate-900`}>
            {`Scattering Ready (${scatteringReady.length}) • ${scatteringReadyWeight} lbs`}
          </h3>
          <div className={displayMode ? 'mt-6 space-y-4' : 'mt-4 space-y-3'}>
            {scatteringReady.length > 0 ? (
              scatteringReady.map((caseItem) => {
                const custodyAgeDays = getCustodyAgeDays(caseItem.createdAt)

                return (
                  <div
                    key={`${caseItem.id}-scattering-ready`}
                    className="rounded-2xl border border-slate-200 px-5 py-4"
                  >
                    <div className="grid gap-4 md:grid-cols-5">
                      <div>
                        <div className="text-sm font-medium text-slate-500">Case Number</div>
                        <div className={`${valueClass} font-semibold text-slate-900`}>
                          {caseItem.caseNumber}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-slate-500">Weight</div>
                        <div className={`${valueClass} font-semibold text-slate-900`}>
                          {formatWeight(caseItem.weight)}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-slate-500">Current Location</div>
                        <div className={`${valueClass} font-semibold text-slate-900`}>
                          {caseItem.location || 'Unassigned'}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-slate-500">Days in Custody</div>
                        <div className={`${valueClass} font-semibold text-slate-900`}>
                          {custodyAgeDays === null ? '—' : `${custodyAgeDays} days`}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-slate-500">Last updated</div>
                        <div className="text-lg font-semibold text-slate-900">
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
              <div className="rounded-2xl border border-slate-200 px-5 py-4 text-slate-600">
                No cases in this section.
              </div>
            )}
          </div>
        </div>
      </div>
      <div className={displayMode ? 'mt-8 space-y-6' : 'mt-6 space-y-4'}>
        {cases.length > 0 ? (
          cases.map((caseItem) => {
            const custodyAgeDays = getCustodyAgeDays(caseItem.createdAt)
            const printsNeeded = isGeneralPrintNeeded(caseItem)
            const textClass = printsNeeded
              ? 'text-yellow-600'
              : getCustodyUrgencyTextClass(caseItem.createdAt)

            return (
              <div
                key={caseItem.id}
                className="rounded-2xl border border-slate-200 px-5 py-4"
              >
                <div className="grid gap-4 md:grid-cols-7">
                  <div>
                    <div className="text-sm font-medium text-slate-500">Case Number</div>
                    <div className={`${valueClass} font-semibold ${textClass}`}>
                      {caseItem.caseNumber}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-500">Weight</div>
                    <div className={`${valueClass} font-semibold ${textClass}`}>
                      {formatWeight(caseItem.weight)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-500">Days in Custody</div>
                    <div className={`${valueClass} font-semibold ${textClass}`}>
                      {custodyAgeDays === null ? '—' : `${custodyAgeDays} days`}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-500">Current Location</div>
                    <div className={`${valueClass} font-semibold ${textClass}`}>
                      {caseItem.location || 'Unassigned'}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-500">Prints Needed</div>
                    <div className={`${valueClass} font-semibold ${textClass}`}>
                      {printsNeeded ? 'Yes' : 'No'}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-500">Last updated</div>
                    <div className={`text-lg font-semibold ${textClass}`}>
                      {caseItem.lastEventTime
                        ? new Date(caseItem.lastEventTime).toLocaleString()
                        : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-500">Last handled by</div>
                    <div className={`text-lg font-semibold ${textClass}`}>
                      {caseItem.lastEventUser || 'Unassigned'}
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        ) : (
          <div className="rounded-2xl border border-slate-200 px-5 py-4 text-slate-600">
            No cases in this section.
          </div>
        )}
      </div>
    </section>
  )
}

function CaseListSection({
  title,
  cases,
  showLocation = false,
  displayMode = false,
  count,
}: {
  title: string
  cases: WorkroomCase[]
  showLocation?: boolean
  displayMode?: boolean
  count?: number
}) {
  return (
    <section className={`rounded-[28px] bg-white shadow-sm ${displayMode ? 'p-10' : 'p-8'}`}>
      <h2
        className={`${displayMode ? 'text-3xl md:text-4xl' : 'text-2xl'} font-semibold text-slate-900`}
      >
        {typeof count === 'number' ? `${title} (${count})` : title}
      </h2>
      <div className={displayMode ? 'mt-8 space-y-6' : 'mt-6 space-y-4'}>
        {cases.length > 0 ? (
          cases.map((caseItem) => {
            const textClass = getCustodyUrgencyTextClass(caseItem.createdAt)
            const custodyAgeDays = getCustodyAgeDays(caseItem.createdAt)
            const urgency = getUrgencyLabel(caseItem.createdAt)

            return (
              <div
                key={caseItem.id}
                className="rounded-2xl border border-slate-200 px-5 py-4"
              >
                <div className={`grid gap-4 ${showLocation ? 'md:grid-cols-7' : 'md:grid-cols-6'}`}>
                  <div>
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
                    <div className="text-sm font-medium text-slate-500">Case Number</div>
                    <div
                      className={`${displayMode ? 'text-2xl md:text-3xl' : 'text-lg'} font-semibold ${textClass}`}
                    >
                      {caseItem.caseNumber}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-500">Next Step</div>
                    <div
                      className={`${displayMode ? 'text-2xl md:text-3xl' : 'text-lg'} font-semibold ${textClass}`}
                    >
                      {caseItem.nextRequiredEvent
                        ? formatCaseEventType(caseItem.nextRequiredEvent)
                        : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-500">Weight</div>
                    <div className={`text-lg font-semibold ${textClass}`}>
                      {formatWeight(caseItem.weight)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-500">Days in Custody</div>
                    <div className={`text-lg font-semibold ${textClass}`}>
                      {custodyAgeDays === null ? '—' : `${custodyAgeDays} days`}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-500">Last updated</div>
                    <div className={`text-lg font-semibold ${textClass}`}>
                      {caseItem.lastEventTime
                        ? new Date(caseItem.lastEventTime).toLocaleString()
                        : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-500">Last handled by</div>
                    <div className={`text-lg font-semibold ${textClass}`}>
                      {caseItem.lastEventUser || 'Unassigned'}
                    </div>
                  </div>
                  {showLocation ? (
                    <div>
                      <div className="text-sm font-medium text-slate-500">Location</div>
                      <div className={`text-lg font-semibold ${textClass}`}>
                        {caseItem.location || 'Unassigned'}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            )
          })
        ) : (
          <div className="rounded-2xl border border-slate-200 px-5 py-4 text-slate-600">
            No cases in this section.
          </div>
        )}
      </div>
    </section>
  )
}

function LocationBoardSection({
  cases,
  displayMode = false,
}: {
  cases: WorkroomCase[]
  displayMode?: boolean
}) {
  return (
    <section className={`rounded-[28px] bg-white shadow-sm ${displayMode ? 'p-10' : 'p-8'}`}>
      <h2
        className={`${displayMode ? 'text-3xl md:text-4xl' : 'text-2xl'} font-semibold text-slate-900`}
      >
        {`Location Board (${cases.length})`}
      </h2>
      <div className={displayMode ? 'mt-8 space-y-6' : 'mt-6 space-y-4'}>
        {cases.length > 0 ? (
          cases.map((caseItem) => {
            const textClass = getCustodyUrgencyTextClass(caseItem.createdAt)
            const custodyAgeDays = getCustodyAgeDays(caseItem.createdAt)
            const urgency = getUrgencyLabel(caseItem.createdAt)

            return (
              <div
                key={caseItem.id}
                className="rounded-2xl border border-slate-200 px-5 py-4"
              >
                <div className="grid gap-4 md:grid-cols-7">
                  <div>
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
                    <div className="text-sm font-medium text-slate-500">Case Number</div>
                    <div
                      className={`${displayMode ? 'text-2xl md:text-3xl' : 'text-lg'} font-semibold ${textClass}`}
                    >
                      {caseItem.caseNumber}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-500">Current Location</div>
                    <div
                      className={`${displayMode ? 'text-2xl md:text-3xl' : 'text-lg'} font-semibold ${textClass}`}
                    >
                      {caseItem.location || 'Unassigned'}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-500">Weight</div>
                    <div className={`text-lg font-semibold ${textClass}`}>
                      {formatWeight(caseItem.weight)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-500">Next Step</div>
                    <div
                      className={`${displayMode ? 'text-2xl md:text-3xl' : 'text-lg'} font-semibold ${textClass}`}
                    >
                      {caseItem.nextRequiredEvent
                        ? formatCaseEventType(caseItem.nextRequiredEvent)
                        : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-500">Days in Custody</div>
                    <div className={`text-lg font-semibold ${textClass}`}>
                      {custodyAgeDays === null ? '—' : `${custodyAgeDays} days`}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-500">Last updated</div>
                    <div className={`text-lg font-semibold ${textClass}`}>
                      {caseItem.lastEventTime
                        ? new Date(caseItem.lastEventTime).toLocaleString()
                        : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-500">Last handled by</div>
                    <div className={`text-lg font-semibold ${textClass}`}>
                      {caseItem.lastEventUser || 'Unassigned'}
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        ) : (
          <div className="rounded-2xl border border-slate-200 px-5 py-4 text-slate-600">
            No active cases found.
          </div>
        )}
      </div>
    </section>
  )
}

export default async function WorkroomPage() {
  const supabase = createServerSupabase()

  const { data: cases, error: casesError } = await supabase
    .from('cases')
    .select(
      'id, case_number, status, created_at, cremation_type, memorial_items, pet_weight, pet_weight_unit, pet_weight_lbs'
    )
    .not('status', 'in', '(completed,cancelled)')
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

    eventsByCaseId = new Map(
      caseIds.map((caseId) => [
        caseId,
        ((caseEvents as CaseEventRow[] | null) ?? []).filter((event) => event.case_id === caseId),
      ])
    )

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

  const workroomCases: WorkroomCase[] = caseItems.map((caseItem) => {
    const caseEvents = eventsByCaseId.get(caseItem.id) ?? []
    const latestEvent = caseEvents[caseEvents.length - 1]
    const workflowOptions = { cremationType: caseItem.cremation_type }

    return {
      id: caseItem.id,
      caseNumber: caseItem.case_number,
      currentWorkflowStep: getCurrentWorkflowStep(caseEvents, workflowOptions),
      nextRequiredEvent: getNextAllowedEventType(caseEvents, workflowOptions),
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
      cremationType: caseItem.cremation_type,
      memorialItems: caseItem.memorial_items ?? [],
    }
  })

  const activeWorkroomCases = workroomCases.filter((caseItem) => {
    if (isGeneralCase(caseItem)) {
      return caseItem.currentWorkflowStep !== 'scattered'
    }

    return caseItem.currentWorkflowStep !== 'returned'
  })

  const sortedWorkroomCases = [...activeWorkroomCases].sort((a, b) => {
    const aRank = getUrgencyRank(a.createdAt)
    const bRank = getUrgencyRank(b.createdAt)

    if (aRank !== bRank) {
      return aRank - bRank
    }

    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : Number.POSITIVE_INFINITY
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : Number.POSITIVE_INFINITY

    return aTime - bTime
  })

  const overdueNow = sortedWorkroomCases.filter((caseItem) => {
    const days = getCustodyAgeDays(caseItem.createdAt)
    return days !== null && days >= 5
  })

  const generalCases = sortedWorkroomCases
    .filter((caseItem) => isGeneralCase(caseItem))
    .sort((a, b) => {
      const aPrintNeeded = isGeneralPrintNeeded(a) ? 0 : 1
      const bPrintNeeded = isGeneralPrintNeeded(b) ? 0 : 1

      if (aPrintNeeded !== bPrintNeeded) {
        return aPrintNeeded - bPrintNeeded
      }

      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : Number.POSITIVE_INFINITY
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : Number.POSITIVE_INFINITY

      return aTime - bTime
    })

  const totalGeneralWeightLbs = generalCases.reduce((total, caseItem) => {
    return typeof caseItem.weightLbs === 'number' && Number.isFinite(caseItem.weightLbs)
      ? total + caseItem.weightLbs
      : total
  }, 0)

  const communalLoadReady = generalCases.filter((caseItem) => {
    return !isGeneralPrintNeeded(caseItem)
  })

  const communalReadyWeight = communalLoadReady.reduce((total, caseItem) => {
    return typeof caseItem.weightLbs === 'number' && Number.isFinite(caseItem.weightLbs)
      ? total + caseItem.weightLbs
      : total
  }, 0)

  const scatteringReady = generalCases.filter((caseItem) => {
    return caseItem.currentWorkflowStep === 'cremation_completed'
  })

  const scatteringReadyWeight = scatteringReady.reduce((total, caseItem) => {
    return typeof caseItem.weightLbs === 'number' && Number.isFinite(caseItem.weightLbs)
      ? total + caseItem.weightLbs
      : total
  }, 0)

  const coolerWorkRequired = sortedWorkroomCases.filter((caseItem) =>
    ['clay_paw_print', 'nose_print', 'fur_clipping'].includes(caseItem.nextRequiredEvent ?? '')
  )
  const readyForCremation = sortedWorkroomCases.filter(
    (caseItem) => caseItem.nextRequiredEvent === 'cremation_started'
  )
  const readyForPackaging = sortedWorkroomCases.filter(
    (caseItem) => caseItem.nextRequiredEvent === 'packaged' && !isGeneralCase(caseItem)
  )
  const readyForReturn = sortedWorkroomCases.filter(
    (caseItem) => caseItem.nextRequiredEvent === 'returned' && !isGeneralCase(caseItem)
  )

  return (
    <main className="min-h-screen bg-[#f4f3ee] px-6 py-8 md:px-10">
      <DisplayModeWrapper
        title="Workroom"
        description="Internal Horizon dashboard for current work and pet location handoff."
      >
        {(displayMode) => (
          <>
            <AutoRefresh displayMode={displayMode} />
            <WorkroomLegend displayMode={displayMode} />
            <CaseListSection
              title="Overdue Now"
              cases={overdueNow}
              showLocation
              displayMode={displayMode}
              count={overdueNow.length}
            />
            <CaseListSection
              title="Ready for Cremation"
              cases={readyForCremation}
              displayMode={displayMode}
              count={readyForCremation.length}
            />
            <CaseListSection
              title="Cooler - Work Required"
              cases={coolerWorkRequired}
              showLocation
              displayMode={displayMode}
              count={coolerWorkRequired.length}
            />
            <GeneralsSection
              cases={generalCases}
              totalWeightLbs={totalGeneralWeightLbs}
              communalLoadReady={communalLoadReady}
              communalReadyWeight={communalReadyWeight}
              scatteringReady={scatteringReady}
              scatteringReadyWeight={scatteringReadyWeight}
              displayMode={displayMode}
            />
            <CaseListSection
              title="Ready for Packaging"
              cases={readyForPackaging}
              displayMode={displayMode}
              count={readyForPackaging.length}
            />
            <CaseListSection
              title="Ready for Return"
              cases={readyForReturn}
              displayMode={displayMode}
              count={readyForReturn.length}
            />
            <LocationBoardSection
              cases={sortedWorkroomCases}
              displayMode={displayMode}
            />
          </>
        )}
      </DisplayModeWrapper>
    </main>
  )
}
