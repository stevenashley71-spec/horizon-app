import Link from 'next/link'
import { notFound } from 'next/navigation'

import {
  formatCaseEventType,
  getExpectedStatusForLatestCaseEvent,
} from '@/lib/case-events'
import {
  getCompletedOperationalEventTypes,
  getCurrentWorkflowStep,
  getNextAllowedEventType,
  getOrderedOperationalEventTypes,
  isCaseWorkflowComplete,
} from '@/lib/case-workflow'
import { formatCaseStatus, getAllowedNextStatuses } from '@/lib/case-status'
import { resolveCaseDisplayStatus } from '@/lib/resolve-case-display-status'
import { createServerSupabase } from '@/lib/supabase/server'

import { CaseEventForm } from './event-form'
import { StatusUpdateForm } from './status-update-form'

function formatStatus(status: string | null) {
  return formatCaseStatus(status)
}

function getStatusClasses(status: string | null) {
  if (status === 'new') return 'bg-blue-100 text-blue-800'
  if (status === 'received') return 'bg-cyan-100 text-cyan-800'
  if (status === 'in_progress') return 'bg-yellow-100 text-yellow-800'
  if (status === 'cremated') return 'bg-orange-100 text-orange-800'
  if (status === 'ready_for_return') return 'bg-indigo-100 text-indigo-800'
  if (status === 'completed') return 'bg-green-100 text-green-800'
  if (status === 'on_hold') return 'bg-amber-100 text-amber-800'
  if (status === 'cancelled') return 'bg-rose-100 text-rose-800'

  return 'bg-gray-100 text-gray-800'
}

function formatAddress(caseItem: {
  owner_address?: string | null
  owner_city?: string | null
  owner_state?: string | null
  owner_zip?: string | null
}) {
  return [
    caseItem.owner_address,
    caseItem.owner_city,
    caseItem.owner_state,
    caseItem.owner_zip,
  ]
    .filter(Boolean)
    .join(', ')
}

function formatCurrency(value: number | null) {
  return typeof value === 'number' ? `$${value.toFixed(2)}` : '—'
}

function formatWeight(caseItem: {
  pet_weight?: string | number | null
  pet_weight_unit?: string | null
  pet_weight_lbs?: number | null
}) {
  if (!caseItem.pet_weight || !caseItem.pet_weight_unit) {
    return '—'
  }

  const baseWeight = `${caseItem.pet_weight} ${caseItem.pet_weight_unit}`

  if (caseItem.pet_weight_lbs && caseItem.pet_weight_lbs !== caseItem.pet_weight) {
    return `${baseWeight} (${caseItem.pet_weight_lbs} lbs)`
  }

  return baseWeight
}

type StatusHistoryItem = {
  id: string
  previous_status: string | null
  new_status: string
  changed_at: string
  changed_by: string | null
}

type CaseEventItem = {
  id: string
  event_type: string
  created_at: string
  created_by: string | null
}

function isUuidLike(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )
}

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  if (!id || id.includes('[') || id.includes(']')) {
    notFound()
  }

  const supabase = createServerSupabase()

  const caseLookupField = isUuidLike(id) ? 'id' : 'case_number'
  const { data: caseItem, error } = await supabase
    .from('cases')
    .select(
      'id, case_number, created_at, status, clinic_name, pet_name, pet_species, pet_weight, pet_weight_unit, pet_weight_lbs, pet_breed, pet_color, owner_name, owner_phone, owner_email, owner_address, owner_city, owner_state, owner_zip, cremation_type, selected_urn, additional_urns, soulburst_items, memorial_items, subtotal, total'
    )
    .eq(caseLookupField, id)
    .single()

  if (error) {
    throw new Error(error.message)
  }

  if (!caseItem) {
    notFound()
  }

  const { data: statusHistory, error: statusHistoryError } = await supabase
    .from('case_status_history')
    .select('id, previous_status, new_status, changed_at, changed_by')
    .eq('case_id', caseItem.id)
    .order('changed_at', { ascending: false })

  if (statusHistoryError) {
    throw new Error(statusHistoryError.message)
  }

  const nextStatuses = getAllowedNextStatuses(caseItem.status)

  const { data: caseEvents, error: caseEventsError } = await supabase
    .from('case_events')
    .select('id, event_type, created_at, created_by')
    .eq('case_id', caseItem.id)
    .order('created_at', { ascending: false })

  if (caseEventsError) {
    throw new Error(caseEventsError.message)
  }

  const latestEventType = caseEvents?.[0]?.event_type ?? null
  const displayedStatus = resolveCaseDisplayStatus(caseItem.status, caseEvents)
  const expectedStatusFromLatestEvent = getExpectedStatusForLatestCaseEvent(latestEventType)
  const workflowOptions = { cremationType: caseItem.cremation_type }
  const orderedWorkflowSteps = getOrderedOperationalEventTypes(workflowOptions)
  const completedWorkflowSteps = new Set(getCompletedOperationalEventTypes(caseEvents, workflowOptions))
  const currentWorkflowStep = getCurrentWorkflowStep(caseEvents, workflowOptions)
  const nextRequiredEvent = getNextAllowedEventType(caseEvents, workflowOptions)
  const workflowComplete = isCaseWorkflowComplete(caseEvents, workflowOptions)
  const isOperationallyBlocked =
    displayedStatus === 'on_hold' || displayedStatus === 'cancelled'
  const hasStatusEventMismatch =
    Boolean(latestEventType) &&
    Boolean(expectedStatusFromLatestEvent) &&
    caseItem.status !== expectedStatusFromLatestEvent
  const hasEvents = (caseEvents?.length ?? 0) > 0
  const isAdmin = false
  const isStatusLocked = hasEvents && !isAdmin

  return (
    <main className="min-h-screen bg-[#f4f3ee] px-6 py-8 md:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <Link
            href="/cases"
            className="rounded-lg bg-slate-200 px-4 py-2 text-slate-900 hover:bg-slate-300"
          >
            Back to Cases
          </Link>
        </div>

        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
              Case {caseItem.case_number}
            </h1>
            <p className="mt-3 text-xl text-slate-500">Detailed view for case {caseItem.id}</p>
          </div>
          <span
            className={`inline-flex w-fit rounded-full px-4 py-2 text-sm font-semibold ${getStatusClasses(displayedStatus)}`}
          >
            {formatStatus(displayedStatus)}
          </span>
        </div>

        <div className="mt-8 space-y-8">
          <section className="rounded-[28px] bg-white p-8 shadow-sm">
            <h2 className="mb-6 text-2xl font-semibold text-slate-900">Case Information</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="text-sm font-medium text-slate-500">Case Number</div>
                <div className="text-lg font-semibold text-slate-900">{caseItem.case_number}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-slate-500">Status</div>
                <div className="text-lg font-semibold text-slate-900">
                  {formatStatus(displayedStatus)}
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-slate-500">Created At</div>
                <div className="text-lg font-semibold text-slate-900">
                  {new Date(caseItem.created_at).toLocaleString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-slate-500">Clinic</div>
                <div className="text-lg font-semibold text-slate-900">{caseItem.clinic_name || '—'}</div>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] bg-white p-8 shadow-sm">
            <h2 className="mb-6 text-2xl font-semibold text-slate-900">Update Status</h2>
            {hasEvents ? (
              <div className="space-y-3">
                <p className="text-sm text-amber-700">
                  Status is locked once chain-of-custody events begin. Status is now controlled by
                  operational events.
                </p>
                {isAdmin ? (
                  <p className="text-sm text-emerald-700">Admin override enabled</p>
                ) : null}
              </div>
            ) : (
              <>
                <p className="mb-4 text-sm text-slate-500">
                  Case number and other case details are read-only here. Only status can be
                  changed.
                </p>
                <StatusUpdateForm
                  id={caseItem.id}
                  currentStatus={caseItem.status || 'new'}
                  nextStatuses={nextStatuses}
                  disabled={isStatusLocked}
                />
              </>
            )}
          </section>

          <section className="rounded-[28px] bg-white p-8 shadow-sm">
            <h2 className="mb-6 text-2xl font-semibold text-slate-900">Status History</h2>
            {statusHistory && statusHistory.length > 0 ? (
              <div className="space-y-4">
                {(statusHistory as StatusHistoryItem[]).map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-2xl border border-slate-200 px-5 py-4"
                  >
                    <div className="grid gap-4 md:grid-cols-3">
                      <div>
                        <div className="text-sm font-medium text-slate-500">Previous Status</div>
                        <div className="text-lg font-semibold text-slate-900">
                          {formatStatus(entry.previous_status)}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-slate-500">New Status</div>
                        <div className="text-lg font-semibold text-slate-900">
                          {formatStatus(entry.new_status)}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-slate-500">Changed At</div>
                        <div className="text-lg font-semibold text-slate-900">
                          {new Date(entry.changed_at).toLocaleString('en-US', {
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-lg text-slate-600">No status changes recorded yet.</div>
            )}
          </section>

          <section className="rounded-[28px] bg-white p-8 shadow-sm">
            <h2 className="mb-6 text-2xl font-semibold text-slate-900">
              Events / Chain of Custody
            </h2>
            <p className="mb-4 text-sm text-slate-500">
              Operational handling events are append-only and separate from case status.
            </p>
            {hasStatusEventMismatch ? (
              <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Status and chain-of-custody sequence are out of sync. Latest event is{' '}
                {formatCaseEventType(latestEventType)}, which expects status{' '}
                {formatStatus(expectedStatusFromLatestEvent)}.
              </div>
            ) : null}
            <div className="mb-6">
              <div className="rounded-2xl border border-slate-200 px-5 py-4">
                <div className="text-sm font-medium text-slate-500">Current Custody Step</div>
                <div className="mt-1 text-lg font-semibold text-slate-900">
                  {latestEventType ? formatCaseEventType(latestEventType) : 'Not started'}
                </div>
              </div>
            </div>
            <div className="mb-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 px-5 py-4">
                <div className="text-sm font-medium text-slate-500">Current workflow step</div>
                <div className="mt-1 text-lg font-semibold text-slate-900">
                  {currentWorkflowStep ? formatCaseEventType(currentWorkflowStep) : 'None'}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 px-5 py-4">
                <div className="text-sm font-medium text-slate-500">Next required event</div>
                <div className="mt-1 text-lg font-semibold text-slate-900">
                  {nextRequiredEvent ? formatCaseEventType(nextRequiredEvent) : 'Complete'}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 px-5 py-4">
                <div className="text-sm font-medium text-slate-500">Workflow complete</div>
                <div className="mt-1 text-lg font-semibold text-slate-900">
                  {workflowComplete ? 'Yes' : 'No'}
                </div>
              </div>
            </div>
            <div className="mb-6 space-y-3">
              <div className="text-sm font-medium text-slate-500">Workflow Progress</div>
              {orderedWorkflowSteps.map((step) => {
                const isCompleted = completedWorkflowSteps.has(step)
                const isNext = !workflowComplete && !isCompleted && nextRequiredEvent === step
                const stepState = isCompleted ? 'Complete' : isNext ? 'Next' : 'Pending'
                const stepStateClasses = isCompleted
                  ? 'bg-emerald-100 text-emerald-800'
                  : isNext
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-slate-200 text-slate-700'

                return (
                  <div
                    key={step}
                    className="flex items-center justify-between rounded-2xl border border-slate-200 px-5 py-4"
                  >
                    <div className="text-lg font-semibold text-slate-900">
                      {formatCaseEventType(step)}
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-sm font-medium ${stepStateClasses}`}
                    >
                      {stepState}
                    </span>
                  </div>
                )
              })}
            </div>
            {isOperationallyBlocked ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {displayedStatus === 'on_hold'
                  ? 'Operational events are unavailable while this case is on hold.'
                  : 'Operational events are unavailable while this case is cancelled.'}
              </div>
            ) : (
              <CaseEventForm
                caseId={caseItem.id}
                caseEvents={caseEvents}
                cremationType={caseItem.cremation_type}
              />
            )}

            <div className="mt-6">
              {caseEvents && caseEvents.length > 0 ? (
                <div className="space-y-4">
                  {(caseEvents as CaseEventItem[]).map((event) => (
                    <div
                      key={event.id}
                      className="rounded-2xl border border-slate-200 px-5 py-4"
                    >
                      <div className="grid gap-4 md:grid-cols-3">
                        <div>
                          <div className="text-sm font-medium text-slate-500">Event</div>
                          <div className="text-lg font-semibold text-slate-900">
                            {formatCaseEventType(event.event_type)}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-slate-500">Created At</div>
                          <div className="text-lg font-semibold text-slate-900">
                            {new Date(event.created_at).toLocaleString('en-US', {
                              month: 'long',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-slate-500">Created By</div>
                          <div className="text-lg font-semibold text-slate-900">
                            {event.created_by || '—'}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-lg text-slate-600">No custody events recorded yet.</div>
              )}
            </div>
          </section>

          <section className="rounded-[28px] bg-white p-8 shadow-sm">
            <h2 className="mb-6 text-2xl font-semibold text-slate-900">Pet Information</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="text-sm font-medium text-slate-500">Pet Name</div>
                <div className="text-lg font-semibold text-slate-900">{caseItem.pet_name || '—'}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-slate-500">Species</div>
                <div className="text-lg font-semibold text-slate-900">{caseItem.pet_species || '—'}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-slate-500">Weight</div>
                <div className="text-lg font-semibold text-slate-900">{formatWeight(caseItem)}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-slate-500">Breed</div>
                <div className="text-lg font-semibold text-slate-900">{caseItem.pet_breed || '—'}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-slate-500">Color</div>
                <div className="text-lg font-semibold text-slate-900">{caseItem.pet_color || '—'}</div>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] bg-white p-8 shadow-sm">
            <h2 className="mb-6 text-2xl font-semibold text-slate-900">Owner Information</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="text-sm font-medium text-slate-500">Owner Name</div>
                <div className="text-lg font-semibold text-slate-900">{caseItem.owner_name || '—'}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-slate-500">Phone</div>
                <div className="text-lg font-semibold text-slate-900">{caseItem.owner_phone || '—'}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-slate-500">Email</div>
                <div className="text-lg font-semibold text-slate-900">{caseItem.owner_email || '—'}</div>
              </div>
              <div className="md:col-span-2">
                <div className="text-sm font-medium text-slate-500">Address</div>
                <div className="text-lg font-semibold text-slate-900">
                  {formatAddress(caseItem) || '—'}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] bg-white p-8 shadow-sm">
            <h2 className="mb-6 text-2xl font-semibold text-slate-900">Services</h2>
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <div className="text-sm font-medium text-slate-500">Cremation Type</div>
                <div className="text-lg font-semibold text-slate-900">{caseItem.cremation_type || '—'}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-slate-500">Selected Urn</div>
                <div className="text-lg font-semibold text-slate-900">{caseItem.selected_urn || '—'}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-slate-500">Memorial Items</div>
                <div className="text-lg font-semibold text-slate-900">
                  {caseItem.memorial_items?.length ? caseItem.memorial_items.length : '0'}
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-slate-500">SoulBursts</div>
                <div className="text-lg font-semibold text-slate-900">
                  {caseItem.soulburst_items?.length ? caseItem.soulburst_items.length : '0'}
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-slate-500">Additional Urns</div>
                <div className="text-lg font-semibold text-slate-900">
                  {caseItem.additional_urns?.length ? caseItem.additional_urns.length : '0'}
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-slate-500">Total</div>
                <div className="text-lg font-semibold text-slate-900">{formatCurrency(caseItem.total)}</div>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] bg-white p-8 shadow-sm">
            <h2 className="mb-6 text-2xl font-semibold text-slate-900">Pricing</h2>
            <div className="space-y-3">
              <div className="flex justify-between text-lg">
                <span>Subtotal</span>
                <span>{formatCurrency(caseItem.subtotal)}</span>
              </div>
              <div className="flex justify-between border-t pt-3 text-xl font-semibold">
                <span>Total</span>
                <span>{formatCurrency(caseItem.total)}</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
