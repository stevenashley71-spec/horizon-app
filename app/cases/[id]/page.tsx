import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import Script from 'next/script'

import { archiveCaseAdmin } from '@/app/actions/archive-case-admin'
import { ClinicAccessBlocked } from '@/app/components/clinic-access-blocked'
import { ClinicPortalFrame } from '@/app/components/clinic-portal-frame'
import { InternalPortalFrame } from '@/app/components/internal-portal-frame'
import { formatCaseEventType } from '@/lib/case-events'
import { getUserRole } from '@/lib/auth/get-user-role'
import { getAllowedNextStatuses, formatCaseStatus } from '@/lib/case-status'
import { getClinicContextResult } from '@/lib/clinic-auth'
import { resolveCaseDisplayStatus } from '@/lib/resolve-case-display-status'
import { createServiceRoleSupabase } from '@/lib/supabase/server'
import { resolveWorkflow } from '@/lib/workflow/resolve-workflow'

import { CaseEventForm } from './event-form'
import { StatusUpdateForm } from './status-update-form'

const MANUAL_ONLY_STATUSES = new Set(['on_hold', 'cancelled'])

type CaseItem = {
  id: string
  clinic_id: string | null
  case_number: string | null
  created_at: string | null
  archived_at: string | null
  status: string | null
  clinic_name: string | null
  pet_name: string | null
  pet_species: string | null
  pet_weight: string | number | null
  pet_weight_unit: string | null
  pet_weight_lbs: number | null
  pet_breed: string | null
  pet_color: string | null
  owner_name: string | null
  owner_phone: string | null
  owner_email: string | null
  owner_address: string | null
  owner_city: string | null
  owner_state: string | null
  owner_zip: string | null
  cremation_type: string | null
  selected_urn: string | null
  additional_urns: Array<{ urn_id: number | string; urn_name: string; qty: number }> | null
  soulburst_items: Array<{ item_id: number | string; item_name: string; qty: number }> | null
  memorial_items: Array<{ product_id: string; name: string; price_cents: number }> | null
  subtotal: number | null
  total: number | null
}

type CaseEventItem = {
  id: string
  event_type: string
  created_at: string
  created_by: string | null
}

function formatWeight(caseItem: {
  pet_weight?: string | number | null
  pet_weight_unit?: string | null
  pet_weight_lbs?: number | null
}) {
  if (!caseItem.pet_weight || !caseItem.pet_weight_unit) {
    return caseItem.pet_weight_lbs ? `${caseItem.pet_weight_lbs} lbs` : '—'
  }

  const baseWeight = `${caseItem.pet_weight} ${caseItem.pet_weight_unit}`

  if (caseItem.pet_weight_lbs && caseItem.pet_weight_lbs !== caseItem.pet_weight) {
    return `${baseWeight} (${caseItem.pet_weight_lbs} lbs)`
  }

  return baseWeight
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

function formatPickupDate(timestamp: string | null) {
  if (!timestamp) {
    return '—'
  }

  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
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
  const userRole = await getUserRole()

  if (!userRole) {
    redirect('/clinic/login')
  }

  const { id } = await params

  if (!id || id.includes('[') || id.includes(']')) {
    notFound()
  }

  const isInternalUser = userRole.role === 'admin' || userRole.role === 'horizon_staff'
  const isAdminUser = userRole.role === 'admin'
  let clinicContext:
    | {
        clinicName: string
        clinicLogoPath: string | null
      }
    | null = null

  if (!isInternalUser) {
    const clinicResult = await getClinicContextResult()

    if (!clinicResult) {
      redirect('/clinic/login')
    }

    if (clinicResult.kind === 'blocked') {
      return <ClinicAccessBlocked message={clinicResult.message} />
    }

    clinicContext = {
      clinicName: clinicResult.clinic.clinicName,
      clinicLogoPath: clinicResult.clinic.clinicLogoPath,
    }
  }

  const supabase = createServiceRoleSupabase()

  const caseLookupField = isUuidLike(id) ? 'id' : 'case_number'

  const { data: caseItem, error: caseError } = await supabase
    .from('cases')
    .select(
      'id, clinic_id, case_number, created_at, archived_at, status, clinic_name, pet_name, pet_species, pet_weight, pet_weight_unit, pet_weight_lbs, pet_breed, pet_color, owner_name, owner_phone, owner_email, owner_address, owner_city, owner_state, owner_zip, cremation_type, selected_urn, additional_urns, soulburst_items, memorial_items, subtotal, total'
    )
    .eq(caseLookupField, id)
    .single()

  if (caseError) {
    const isNoRowsError =
      caseError.message.includes('No rows') || caseError.code === 'PGRST116'

    if (!isNoRowsError) {
      throw new Error('Unable to load case')
    }
  }

  if (!caseItem) {
    notFound()
  }

  const typedCaseItem = caseItem as CaseItem

  if (!isInternalUser && typedCaseItem.clinic_id !== userRole.clinicId) {
    notFound()
  }

  if (!isInternalUser && typedCaseItem.archived_at) {
    notFound()
  }

  const { data: caseEvents, error: caseEventsError } = await supabase
    .from('case_events')
    .select('id, event_type, created_at, created_by')
    .eq('case_id', typedCaseItem.id)
    .order('created_at', { ascending: false })

  if (caseEventsError) {
    throw new Error('Unable to load case events')
  }

  const typedCaseEvents = (caseEvents as CaseEventItem[] | null) ?? []
  const displayedStatus = resolveCaseDisplayStatus(typedCaseItem.status, typedCaseEvents)
  const manualNextStatuses = getAllowedNextStatuses(typedCaseItem.status).filter((status) =>
    MANUAL_ONLY_STATUSES.has(status)
  )
  const workflow = await resolveWorkflow({
    caseId: typedCaseItem.id,
    cremationType: typedCaseItem.cremation_type === 'general' ? 'general' : 'private',
    events: typedCaseEvents.map((event) => ({
      event_type: event.event_type,
      created_at: event.created_at,
    })),
  })
  const nextStep = workflow.nextStep
  const isComplete = workflow.isComplete
  const memorialItems = typedCaseItem.memorial_items ?? []
  const additionalUrns = typedCaseItem.additional_urns ?? []
  const soulburstItems = typedCaseItem.soulburst_items ?? []
  const showPrintPickupSheetButton = isAdminUser && nextStep === 'picked_up' && isComplete === false
  const caseQrPayload = `HPC_CASE:${typedCaseItem.case_number ?? ''}`

  const caseContent = (
    <div className="space-y-8">
      <style>{`
        .single-print-sheet {
          display: none;
        }
      `}</style>

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            id="case-detail-back-link"
            href="/cases"
            className="rounded-lg bg-slate-200 px-4 py-2 text-slate-900 hover:bg-slate-300"
          >
            Back to Cases
          </Link>
          {showPrintPickupSheetButton ? (
            <button
              id="print-single-pickup-sheet"
              type="button"
              className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-800"
            >
              Print Pickup Sheet
            </button>
          ) : null}
        </div>
        {isAdminUser ? (
          <form
            action={async (formData: FormData) => {
              'use server'
              await archiveCaseAdmin(formData)
            }}
          >
            <input type="hidden" name="case_id" value={typedCaseItem.id} />
            <button
              type="submit"
              disabled={Boolean(typedCaseItem.archived_at)}
              className="rounded-lg bg-rose-100 px-4 py-2 font-medium text-rose-800 hover:bg-rose-200 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
            >
              {typedCaseItem.archived_at ? 'Archived' : 'Archive Case'}
            </button>
          </form>
        ) : null}
      </div>

      <section className="rounded-[28px] bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
              Case Detail
            </div>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
              {typedCaseItem.case_number || 'Case'}
            </h1>
            <p className="mt-3 text-xl text-slate-500">
              {typedCaseItem.pet_name || 'Unnamed pet'}
            </p>
          </div>
          <span
            className={`inline-flex w-fit rounded-full px-4 py-2 text-sm font-semibold ${getStatusClasses(displayedStatus)}`}
          >
            {formatCaseStatus(displayedStatus)}
          </span>
        </div>
      </section>

      {!isInternalUser ? (
        <section className="rounded-[28px] bg-white p-6 shadow-sm">
          <p className="text-base text-slate-600">
            This case is read-only for clinic users. Internal Horizon workflow controls are hidden.
          </p>
        </section>
      ) : null}

      {isInternalUser ? (
        <section className="rounded-[28px] bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-semibold text-slate-900">Next Action</h2>
          {!isComplete && nextStep ? (
            <>
              <p className="mt-3 text-sm text-slate-500">
                The next workflow step for this case is{' '}
                <span className="font-semibold text-slate-900">
                  {formatCaseEventType(nextStep)}
                </span>
                .
              </p>
              <div className="mt-6">
                <CaseEventForm
                  caseId={typedCaseItem.id}
                  caseEvents={typedCaseEvents}
                  cremationType={typedCaseItem.cremation_type}
                  allowedEventType={nextStep}
                  currentStep={workflow.currentStep}
                  nextStep={workflow.nextStep}
                  isComplete={workflow.isComplete}
                />
              </div>
            </>
          ) : (
            <p className="mt-3 text-base text-slate-600">
              No further workflow actions are available.
            </p>
          )}
        </section>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="rounded-[28px] bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-semibold text-slate-900">Pet and Owner Information</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div>
              <div className="text-sm font-medium text-slate-500">Pet Name</div>
              <div className="text-lg font-semibold text-slate-900">
                {typedCaseItem.pet_name || '—'}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-slate-500">Species</div>
              <div className="text-lg font-semibold text-slate-900">
                {typedCaseItem.pet_species || '—'}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-slate-500">Breed</div>
              <div className="text-lg font-semibold text-slate-900">
                {typedCaseItem.pet_breed || '—'}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-slate-500">Color</div>
              <div className="text-lg font-semibold text-slate-900">
                {typedCaseItem.pet_color || '—'}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-slate-500">Weight</div>
              <div className="text-lg font-semibold text-slate-900">
                {formatWeight(typedCaseItem)}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-slate-500">Owner Name</div>
              <div className="text-lg font-semibold text-slate-900">
                {typedCaseItem.owner_name || '—'}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-slate-500">Owner Phone</div>
              <div className="text-lg font-semibold text-slate-900">
                {typedCaseItem.owner_phone || '—'}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-slate-500">Owner Email</div>
              <div className="text-lg font-semibold text-slate-900">
                {typedCaseItem.owner_email || '—'}
              </div>
            </div>
            <div className="md:col-span-2">
              <div className="text-sm font-medium text-slate-500">Address</div>
              <div className="text-lg font-semibold text-slate-900">
                {formatAddress(typedCaseItem) || '—'}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[28px] bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-semibold text-slate-900">Clinic Information</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div>
              <div className="text-sm font-medium text-slate-500">Clinic</div>
              <div className="text-lg font-semibold text-slate-900">
                {typedCaseItem.clinic_name || '—'}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-slate-500">Created</div>
              <div className="text-lg font-semibold text-slate-900">
                {typedCaseItem.created_at
                  ? new Date(typedCaseItem.created_at).toLocaleString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '—'}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-slate-500">Cremation Type</div>
              <div className="text-lg font-semibold text-slate-900">
                {typedCaseItem.cremation_type || '—'}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-slate-500">Subtotal</div>
              <div className="text-lg font-semibold text-slate-900">
                {formatCurrency(typedCaseItem.subtotal)}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-slate-500">Total</div>
              <div className="text-lg font-semibold text-slate-900">
                {formatCurrency(typedCaseItem.total)}
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-[28px] bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-900">Memorial and Urn Selections</h2>
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 p-5">
            <div className="text-sm font-medium text-slate-500">Selected Urn</div>
            <div className="mt-2 text-lg font-semibold text-slate-900">
              {typedCaseItem.selected_urn || '—'}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 p-5">
            <div className="text-sm font-medium text-slate-500">Additional Urns</div>
            {additionalUrns.length > 0 ? (
              <div className="mt-3 space-y-2">
                {additionalUrns.map((item, index) => (
                  <div key={`${item.urn_id}-${index}`} className="text-sm text-slate-700">
                    {item.urn_name} x{item.qty}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-2 text-lg font-semibold text-slate-900">—</div>
            )}
          </div>
          <div className="rounded-2xl border border-slate-200 p-5">
            <div className="text-sm font-medium text-slate-500">Memorial Items</div>
            {memorialItems.length > 0 ? (
              <div className="mt-3 space-y-2">
                {memorialItems.map((item, index) => (
                  <div key={`${item.product_id}-${index}`} className="text-sm text-slate-700">
                    {item.name}
                    {typeof item.price_cents === 'number'
                      ? ` (${formatCurrency(item.price_cents / 100)})`
                      : ''}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-2 text-lg font-semibold text-slate-900">—</div>
            )}
          </div>
        </div>
        {soulburstItems.length > 0 ? (
          <div className="mt-6 rounded-2xl border border-slate-200 p-5">
            <div className="text-sm font-medium text-slate-500">SoulBursts</div>
            <div className="mt-3 space-y-2">
              {soulburstItems.map((item, index) => (
                <div key={`${item.item_id}-${index}`} className="text-sm text-slate-700">
                  {item.item_name} x{item.qty}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {isInternalUser ? (
        <section className="rounded-[28px] bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-semibold text-slate-900">Manual Status Controls</h2>
          <p className="mt-3 text-sm text-slate-500">
            Manual status updates are limited to manual-only states and do not replace
            resolver-driven workflow actions.
          </p>
          <div className="mt-6">
            <StatusUpdateForm
              id={typedCaseItem.id}
              currentStatus={typedCaseItem.status || 'new'}
              nextStatuses={manualNextStatuses}
            />
          </div>
        </section>
      ) : null}

      <section className="rounded-[28px] bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-900">Event Timeline</h2>
        <p className="mt-3 text-sm text-slate-500">
          Events are shown in reverse chronological order.
        </p>

        {typedCaseEvents.length === 0 ? (
          <div className="mt-6 text-lg text-slate-600">No events recorded yet.</div>
        ) : (
          <div className="mt-6 space-y-4">
            {typedCaseEvents.map((event) => (
              <div key={event.id} className="rounded-2xl border border-slate-200 p-5">
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <div className="text-sm font-medium text-slate-500">Event</div>
                    <div className="mt-1 text-lg font-semibold text-slate-900">
                      {formatCaseEventType(event.event_type)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-500">Created At</div>
                    <div className="mt-1 text-lg font-semibold text-slate-900">
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
                    <div className="mt-1 text-lg font-semibold text-slate-900">
                      {event.created_by || '—'}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {showPrintPickupSheetButton ? (
        <>
          <div className="single-print-sheet">
            <section className="pickup-print-sheet">
              <div className="pickup-print-card mx-auto max-w-3xl rounded-[24px] border border-slate-300 p-8">
                <div className="pickup-print-header border-b border-slate-300 pb-4">
                  <div className="pickup-print-eyebrow text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Horizon Pickup Sheet
                  </div>
                  <h1 className="pickup-print-title mt-2 text-3xl font-bold text-slate-900">
                    {typedCaseItem.case_number || 'Case Pending Number'}
                  </h1>
                  <p className="pickup-print-subtitle mt-2 text-lg text-slate-700">
                    {typedCaseItem.clinic_name || 'Unknown Clinic'}
                  </p>
                </div>

                <div className="pickup-print-details mt-8 grid gap-6 md:grid-cols-2">
                  <div>
                    <div className="pickup-print-detail-label text-sm font-medium uppercase tracking-wide text-slate-500">
                      Pet Name
                    </div>
                    <div className="pickup-print-detail-value mt-2 text-2xl font-semibold text-slate-900">
                      {typedCaseItem.pet_name || '—'}
                    </div>
                  </div>
                  <div>
                    <div className="pickup-print-detail-label text-sm font-medium uppercase tracking-wide text-slate-500">
                      Owner Name
                    </div>
                    <div className="pickup-print-detail-value mt-2 text-2xl font-semibold text-slate-900">
                      {typedCaseItem.owner_name || '—'}
                    </div>
                  </div>
                  <div>
                    <div className="pickup-print-detail-label text-sm font-medium uppercase tracking-wide text-slate-500">
                      Clinic
                    </div>
                    <div className="pickup-print-detail-value pickup-print-detail-value--secondary mt-2 text-xl font-semibold text-slate-900">
                      {typedCaseItem.clinic_name || 'Unknown Clinic'}
                    </div>
                  </div>
                  <div>
                    <div className="pickup-print-detail-label text-sm font-medium uppercase tracking-wide text-slate-500">
                      Intake Date
                    </div>
                    <div className="pickup-print-detail-value pickup-print-detail-value--secondary mt-2 text-xl font-semibold text-slate-900">
                      {formatPickupDate(typedCaseItem.created_at)}
                    </div>
                  </div>
                </div>

                <div className="pickup-print-codes mt-10 grid gap-6 md:grid-cols-2">
                  <div className="pickup-print-code-card rounded-2xl border border-slate-200 p-5 text-center">
                    <div className="pickup-print-code-label text-sm font-medium uppercase tracking-wide text-slate-500">
                      Case Scan
                    </div>
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(caseQrPayload)}`}
                      alt={`Case QR for ${typedCaseItem.case_number || 'case'}`}
                      className="pickup-print-code-image mx-auto mt-4 h-[120px] w-[120px]"
                    />
                    <div className="pickup-print-code-text mt-3 break-all text-xs text-slate-500">
                      {caseQrPayload}
                    </div>
                  </div>
                </div>

                <div className="pickup-print-notes mt-10 rounded-2xl border border-dashed border-slate-300 p-6">
                  <div className="pickup-print-notes-label text-sm font-medium uppercase tracking-wide text-slate-500">
                    Manual Verification Notes
                  </div>
                  <div className="pickup-print-notes-body mt-4 space-y-4 text-base text-slate-700">
                    <p>Verify case number, pet name, clinic, and owner details before transport.</p>
                    <div className="pickup-print-note-line h-20 rounded-xl border border-slate-200" />
                    <div className="pickup-print-note-line h-20 rounded-xl border border-slate-200" />
                  </div>
                </div>
              </div>
            </section>
          </div>

          <Script id="single-pickup-print-handler" strategy="afterInteractive">
            {`
              (() => {
                const button = document.getElementById('print-single-pickup-sheet');
                if (!button || button.dataset.printBound === 'true') {
                  return;
                }
                button.dataset.printBound = 'true';
                button.addEventListener('click', () => {
                  const source = document.querySelector('.single-print-sheet');
                  if (!source) {
                    return;
                  }
                  const sourceMarkup = source.outerHTML;

                  const popup = window.open('', '_blank', 'width=1024,height=768');
                  if (!popup) {
                    return;
                  }

                  popup.document.open();
                  popup.document.write(\`
                    <!doctype html>
                    <html>
                      <head>
                        <meta charset="utf-8" />
                        <meta name="viewport" content="width=device-width, initial-scale=1" />
                        <title>Pickup Sheet</title>
                        <style>
                          @page {
                            margin: 0.35in;
                          }

                          html, body {
                            margin: 0;
                            padding: 0;
                            background: #fff;
                            color: #0f172a;
                            font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                          }

                          .pickup-print-sheet {
                            break-inside: avoid;
                            page-break-inside: avoid;
                            min-height: 0;
                            padding: 12px;
                          }

                          .pickup-print-sheet + .pickup-print-sheet {
                            break-before: page;
                            page-break-before: always;
                          }

                          .pickup-print-card {
                            max-width: 100%;
                            border: 1px solid #cbd5e1;
                            border-radius: 16px;
                            padding: 20px;
                            box-sizing: border-box;
                          }

                          .pickup-print-header {
                            border-bottom: 1px solid #cbd5e1;
                            padding-bottom: 12px;
                          }

                          .pickup-print-eyebrow {
                            font-size: 11px;
                            font-weight: 600;
                            letter-spacing: 0.2em;
                            text-transform: uppercase;
                            color: #64748b;
                          }

                          .pickup-print-title {
                            margin-top: 6px;
                            font-size: 28px;
                            line-height: 1.1;
                            font-weight: 700;
                            color: #0f172a;
                          }

                          .pickup-print-subtitle {
                            margin-top: 6px;
                            font-size: 16px;
                            line-height: 1.25;
                            color: #334155;
                          }

                          .pickup-print-details {
                            margin-top: 24px;
                            display: grid;
                            grid-template-columns: repeat(2, minmax(0, 1fr));
                            gap: 16px;
                          }

                          .pickup-print-detail-label {
                            font-size: 11px;
                            font-weight: 500;
                            letter-spacing: 0.08em;
                            text-transform: uppercase;
                            color: #64748b;
                          }

                          .pickup-print-detail-value {
                            margin-top: 4px;
                            font-size: 20px;
                            line-height: 1.15;
                            font-weight: 600;
                            color: #0f172a;
                          }

                          .pickup-print-detail-value--secondary {
                            font-size: 17px;
                          }

                          .pickup-print-codes {
                            margin-top: 24px;
                            display: grid;
                            grid-template-columns: repeat(2, minmax(0, 1fr));
                            gap: 16px;
                          }

                          .pickup-print-code-card {
                            border: 1px solid #e2e8f0;
                            border-radius: 16px;
                            padding: 16px;
                            text-align: center;
                          }

                          .pickup-print-code-label {
                            font-size: 11px;
                            font-weight: 500;
                            letter-spacing: 0.08em;
                            text-transform: uppercase;
                            color: #64748b;
                          }

                          .pickup-print-code-image {
                            display: block;
                            margin: 12px auto 0;
                            height: 104px;
                            width: 104px;
                          }

                          .pickup-print-code-text {
                            margin-top: 8px;
                            font-size: 10px;
                            line-height: 1.25;
                            color: #64748b;
                            word-break: break-all;
                          }

                          .pickup-print-notes {
                            margin-top: 24px;
                            border: 1px dashed #cbd5e1;
                            border-radius: 16px;
                            padding: 16px;
                          }

                          .pickup-print-notes-label {
                            font-size: 11px;
                            font-weight: 500;
                            letter-spacing: 0.08em;
                            text-transform: uppercase;
                            color: #64748b;
                          }

                          .pickup-print-notes-body {
                            margin-top: 12px;
                            font-size: 14px;
                            line-height: 1.3;
                            color: #334155;
                          }

                          .pickup-print-note-line {
                            height: 56px;
                            margin-top: 12px;
                            border: 1px solid #e2e8f0;
                            border-radius: 12px;
                          }
                        </style>
                      </head>
                      <body>
                        \${sourceMarkup}
                      </body>
                    </html>
                  \`);
                  popup.document.close();

                  popup.addEventListener('load', () => {
                    popup.focus();
                    popup.print();
                    popup.close();
                  });
                });
              })();
            `}
          </Script>
        </>
      ) : null}
    </div>
  )

  if (clinicContext) {
    return (
      <ClinicPortalFrame
        clinicName={clinicContext.clinicName}
        clinicLogoPath={clinicContext.clinicLogoPath}
      >
        {caseContent}
      </ClinicPortalFrame>
    )
  }

  return <InternalPortalFrame>{caseContent}</InternalPortalFrame>
}
