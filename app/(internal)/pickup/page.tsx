import Link from 'next/link'
import Script from 'next/script'

import { CASE_EVENT_TYPES } from '@/lib/case-events'
import { createServiceRoleSupabase } from '@/lib/supabase/server'
import { resolveWorkflow } from '@/lib/workflow/resolve-workflow'

type CaseRow = {
  id: string
  case_number: string | null
  pet_name: string | null
  owner_name: string | null
  clinic_id: string | null
  clinic_name: string | null
  status: string | null
  created_at: string | null
  cremation_type: string | null
  pickup_verification_code: string | null
}

type RawCaseRow = {
  id: string
  case_number: string | null
  pet_name: string | null
  owner_name: string | null
  clinic_id: string | null
  clinic_name: string | null
  status: string | null
  created_at: string | null
  cremation_type: string | null
  clinics?: {
    pickup_verification_code?: string | null
  } | null
}

type CaseEventRow = {
  case_id: string
  event_type: string
  created_at: string
}

type PickupCase = CaseRow & {
  currentStep: string | null
  nextStep: string | null
  isComplete: boolean
  isAtInitialStep: boolean
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

export default async function PickupPage() {
  const supabase = createServiceRoleSupabase()

  const { data: cases, error } = await supabase
    .from('cases')
    .select(
      'id, case_number, pet_name, owner_name, clinic_id, clinic_name, status, created_at, cremation_type, clinics(pickup_verification_code)'
    )
    .is('archived_at', null)
    .order('created_at', { ascending: true })

  if (error) {
    return (
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
            Clinic Pickup Queue
          </h1>
          <p className="mt-3 text-xl text-slate-500">Unable to load pickup queue.</p>
        </div>
    )
  }

  const caseIds = cases?.map((caseItem) => caseItem.id) ?? []
  let pickupCases: PickupCase[] =
    (((cases as RawCaseRow[] | null) ?? [])).map((caseItem) => ({
      id: caseItem.id,
      case_number: caseItem.case_number,
      pet_name: caseItem.pet_name,
      owner_name: caseItem.owner_name,
      clinic_id: caseItem.clinic_id,
      clinic_name: caseItem.clinic_name,
      status: caseItem.status,
      created_at: caseItem.created_at,
      cremation_type: caseItem.cremation_type,
      pickup_verification_code:
        typeof caseItem.clinics?.pickup_verification_code === 'string'
          ? caseItem.clinics.pickup_verification_code
          : null,
      currentStep: null,
      nextStep: null,
      isComplete: false,
      isAtInitialStep: false,
    }))

  if (caseIds.length > 0) {
    const { data: caseEvents, error: caseEventsError } = await supabase
      .from('case_events')
      .select('case_id, event_type, created_at')
      .in('case_id', caseIds)

    if (caseEventsError) {
      return (
        <div>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
              Clinic Pickup Queue
            </h1>
            <p className="mt-3 text-xl text-slate-500">
              Unable to load pickup events.
            </p>
        </div>
      )
    }

    const eventsByCaseId = new Map<string, CaseEventRow[]>()

    for (const event of (caseEvents as CaseEventRow[] | null) ?? []) {
      const existingEvents = eventsByCaseId.get(event.case_id) ?? []
      existingEvents.push(event)
      eventsByCaseId.set(event.case_id, existingEvents)
    }

    pickupCases = await Promise.all(
      (((cases as RawCaseRow[] | null) ?? [])).map(async (caseItem) => {
        const workflowEvents = (eventsByCaseId.get(caseItem.id) ?? []).map((event) => ({
          event_type: event.event_type,
          created_at: event.created_at,
        }))

        const workflow = await resolveWorkflow({
          caseId: caseItem.id,
          cremationType: caseItem.cremation_type === 'general' ? 'general' : 'private',
          events: workflowEvents,
        })

        return {
          id: caseItem.id,
          case_number: caseItem.case_number,
          pet_name: caseItem.pet_name,
          owner_name: caseItem.owner_name,
          clinic_id: caseItem.clinic_id,
          clinic_name: caseItem.clinic_name,
          status: caseItem.status,
          created_at: caseItem.created_at,
          cremation_type: caseItem.cremation_type,
          pickup_verification_code:
            typeof caseItem.clinics?.pickup_verification_code === 'string'
              ? caseItem.clinics.pickup_verification_code
              : null,
          currentStep: workflow.currentStep,
          nextStep: workflow.nextStep,
          isComplete: workflow.isComplete,
          isAtInitialStep: workflow.isAtInitialStep,
        }
      })
    )
  }

  const queueCases = pickupCases.filter(
    (caseItem) =>
      caseItem.nextStep === CASE_EVENT_TYPES.PICKED_UP &&
      caseItem.isComplete === false
  )
  const inProgressCases = pickupCases.filter(
    (caseItem) =>
      caseItem.isAtInitialStep === false &&
      caseItem.isComplete === false
  )
  const completedCases = pickupCases.filter((caseItem) => caseItem.isComplete === true)
  void inProgressCases
  void completedCases
  const clinicGroups = new Map<string, PickupCase[]>()

  for (const caseItem of queueCases) {
    const clinicName = caseItem.clinic_name?.trim() || 'Unknown Clinic'
    const existingGroup = clinicGroups.get(clinicName) ?? []
    existingGroup.push(caseItem)
    clinicGroups.set(clinicName, existingGroup)
  }

  const sortedClinicGroups = Array.from(clinicGroups.entries())
    .map(([clinicName, clinicCases]) => [
      clinicName,
      [...clinicCases].sort((a, b) => {
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0
        return aTime - bTime
      }),
    ] as const)
    .sort(([clinicA], [clinicB]) => clinicA.localeCompare(clinicB))

  return (
    <div>
      <style>{`
        .pickup-print-sheets {
          display: none;
        }
      `}</style>

        <div className="pickup-screen-ui">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
            Clinic Pickup Queue
          </h1>
          <p className="mt-3 text-xl text-slate-500">
            Active clinic cases that have not yet been picked up by Horizon.
          </p>

          <div className="mt-6">
            <button
              id="print-pickup-sheets"
              type="button"
              className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-800"
            >
              Print Pickup Sheets
            </button>
          </div>

          <div className="mt-8 overflow-hidden rounded-[28px] bg-white shadow-sm">
            {queueCases.length === 0 ? (
              <div className="p-6">
                <p className="text-lg text-slate-600">
                  No clinic cases are currently waiting for pickup.
                </p>
              </div>
            ) : (
              <div className="space-y-8 p-6">
                {sortedClinicGroups.map(([clinicName, clinicCases]) => (
                  <section key={clinicName} className="overflow-hidden rounded-[24px] border border-slate-200">
                    <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
                      <h2 className="text-2xl font-semibold text-slate-900">{clinicName}</h2>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full border-collapse">
                        <thead className="bg-slate-50">
                          <tr className="text-left">
                            <th className="px-6 py-4 text-sm font-semibold text-slate-600">Case Number</th>
                            <th className="px-6 py-4 text-sm font-semibold text-slate-600">Pet Name</th>
                            <th className="px-6 py-4 text-sm font-semibold text-slate-600">Owner Name</th>
                            <th className="px-6 py-4 text-sm font-semibold text-slate-600">Clinic</th>
                            <th className="px-6 py-4 text-sm font-semibold text-slate-600">Created</th>
                            <th className="px-6 py-4 text-sm font-semibold text-slate-600">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {clinicCases.map((caseItem) => (
                            <tr key={caseItem.id} className="border-t border-slate-200 align-top">
                              <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                                <Link href={`/cases/${caseItem.id}`} className="hover:underline">
                                  {caseItem.case_number || '—'}
                                </Link>
                              </td>
                              <td className="px-6 py-4 text-sm text-slate-700">
                                {caseItem.pet_name || '—'}
                              </td>
                              <td className="px-6 py-4 text-sm text-slate-700">
                                {caseItem.owner_name || '—'}
                              </td>
                              <td className="px-6 py-4 text-sm text-slate-700">
                                {caseItem.clinic_name || 'Unknown Clinic'}
                              </td>
                              <td className="px-6 py-4 text-sm text-slate-700">
                                {formatPickupDate(caseItem.created_at)}
                              </td>
                              <td className="px-6 py-4 text-sm">
                                <div className="flex flex-wrap items-center gap-3">
                                  <Link
                                    href={`/cases/${caseItem.id}`}
                                    className="rounded-lg bg-slate-200 px-4 py-2 font-medium text-slate-900 hover:bg-slate-300"
                                  >
                                    View Case
                                  </Link>
                                  <Link
                                    href="/scan"
                                    className="rounded-lg bg-emerald-900 px-4 py-2 font-medium text-white hover:bg-emerald-800"
                                  >
                                    Go to Scan Station
                                  </Link>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="pickup-print-sheets">
          {sortedClinicGroups.flatMap(([clinicName, clinicCases]) =>
            clinicCases.map((caseItem) => (
              <section key={`print-${caseItem.id}`} className="pickup-print-sheet">
                {(() => {
                  const caseQrPayload = `HPC_CASE:${caseItem.case_number ?? ''}`

                  return (
                <div className="pickup-print-card mx-auto max-w-3xl rounded-[24px] border border-slate-300 p-8">
                  <div className="pickup-print-header border-b border-slate-300 pb-4">
                    <div className="pickup-print-eyebrow text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Horizon Pickup Sheet
                    </div>
                    <h1 className="pickup-print-title mt-2 text-3xl font-bold text-slate-900">
                      {caseItem.case_number || 'Case Pending Number'}
                    </h1>
                    <p className="pickup-print-subtitle mt-2 text-lg text-slate-700">
                      {clinicName}
                    </p>
                  </div>

                  <div className="pickup-print-details mt-8 grid gap-6 md:grid-cols-2">
                    <div>
                      <div className="pickup-print-detail-label text-sm font-medium uppercase tracking-wide text-slate-500">
                        Pet Name
                      </div>
                      <div className="pickup-print-detail-value mt-2 text-2xl font-semibold text-slate-900">
                        {caseItem.pet_name || '—'}
                      </div>
                    </div>
                    <div>
                      <div className="pickup-print-detail-label text-sm font-medium uppercase tracking-wide text-slate-500">
                        Owner Name
                      </div>
                      <div className="pickup-print-detail-value mt-2 text-2xl font-semibold text-slate-900">
                        {caseItem.owner_name || '—'}
                      </div>
                    </div>
                    <div>
                      <div className="pickup-print-detail-label text-sm font-medium uppercase tracking-wide text-slate-500">
                        Clinic
                      </div>
                      <div className="pickup-print-detail-value pickup-print-detail-value--secondary mt-2 text-xl font-semibold text-slate-900">
                        {caseItem.clinic_name || 'Unknown Clinic'}
                      </div>
                    </div>
                    <div>
                      <div className="pickup-print-detail-label text-sm font-medium uppercase tracking-wide text-slate-500">
                        Intake Date
                      </div>
                      <div className="pickup-print-detail-value pickup-print-detail-value--secondary mt-2 text-xl font-semibold text-slate-900">
                        {formatPickupDate(caseItem.created_at)}
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
                        alt={`Case QR for ${caseItem.case_number || 'case'}`}
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
                  )
                })()}
              </section>
            ))
          )}
        </div>

      <Script id="pickup-print-handler" strategy="afterInteractive">
        {`
          (() => {
            const button = document.getElementById('print-pickup-sheets');
            if (!button || button.dataset.printBound === 'true') {
                return;
            }
            button.dataset.printBound = 'true';
            button.addEventListener('click', () => {
              const source = document.querySelector('.pickup-print-sheets');
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
                    <title>Pickup Sheets</title>
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
    </div>
  )
}
