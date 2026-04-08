'use client'

import Script from 'next/script'
import { useActionState, useRef, useState } from 'react'

import { updateClinicUserPasswordAdmin } from '@/app/actions/admin-clinic-users'
import {
  archiveClinicAdmin,
  saveClinicAdmin,
  setClinicActive,
  updateClinicExitPinAdmin,
} from '@/app/actions/admin-clinics'
import { ClinicForm } from './clinic-form'

type ClinicItem = {
  id: string
  name: string
  code: string | null
  pickup_verification_code: string | null
  delivery_verification_code: string | null
  address_line_1: string | null
  address_line_2: string | null
  city: string | null
  state: string | null
  zip: string | null
  phone: string | null
  email: string | null
  logo_path: string | null
  logo_alt_text: string | null
  logo_url: string | null
  allows_donation_intake: boolean
  archived_at: string | null
  is_active: boolean
  pickup_qr: string | null
  delivery_qr: string | null
  pickup_print_payload: string | null
  delivery_print_payload: string | null
  pickup_print_qr: string | null
  delivery_print_qr: string | null
  linked_users: {
    user_id: string
    email: string | null
  }[]
}

type PasswordFormState = {
  error: string | null
  success: string | null
}

const initialPasswordFormState: PasswordFormState = {
  error: null,
  success: null,
}

function ClinicExitPinForm({ clinicId }: { clinicId: string }) {
  const formRef = useRef<HTMLFormElement | null>(null)
  const [state, formAction] = useActionState(
    async (
      _previousState: PasswordFormState,
      formData: FormData
    ): Promise<PasswordFormState> => {
      try {
        await updateClinicExitPinAdmin(formData)
        formRef.current?.reset()

        return {
          error: null,
          success: 'PIN updated',
        }
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : 'Failed to update PIN.',
          success: null,
        }
      }
    },
    initialPasswordFormState
  )

  return (
    <form
      ref={formRef}
      action={formAction}
      className="mt-3 flex flex-col gap-3 md:flex-row md:items-center"
    >
      <input type="hidden" name="clinic_id" value={clinicId} />
      <div className="w-full md:max-w-xs">
        <input
          name="exit_pin"
          type="password"
          placeholder="Enter new PIN"
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
        />
        <p className="mt-2 text-sm text-slate-500">
          Set or update the clinic exit PIN. Leave blank to disable.
        </p>
      </div>
      <button
        type="submit"
        className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white"
      >
        Update PIN
      </button>
      {state.success ? (
        <p className="text-sm text-emerald-700">{state.success}</p>
      ) : null}
      {state.error ? <p className="text-sm text-rose-700">{state.error}</p> : null}
    </form>
  )
}

function ClinicUserPasswordForm({
  userId,
  email,
}: {
  userId: string
  email: string | null
}) {
  const formRef = useRef<HTMLFormElement | null>(null)
  const [state, formAction] = useActionState(
    async (
      _previousState: PasswordFormState,
      formData: FormData
    ): Promise<PasswordFormState> => {
      try {
        await updateClinicUserPasswordAdmin(formData)
        formRef.current?.reset()

        return {
          error: null,
          success: `Password updated for ${email || 'clinic user'}.`,
        }
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : 'Failed to update password.',
          success: null,
        }
      }
    },
    initialPasswordFormState
  )

  return (
    <form
      ref={formRef}
      action={formAction}
      className="mt-3 flex flex-col gap-3 md:flex-row md:items-center"
    >
      <input type="hidden" name="user_id" value={userId} />
      <input
        name="password"
        type="password"
        minLength={8}
        required
        placeholder="Set new password"
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 md:max-w-xs"
      />
      <button
        type="submit"
        className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white"
      >
        Update Password
      </button>
      {state.success ? (
        <p className="text-sm text-emerald-700">{state.success}</p>
      ) : null}
      {state.error ? <p className="text-sm text-rose-700">{state.error}</p> : null}
    </form>
  )
}

export function ClinicAccordionList({ clinicItems }: { clinicItems: ClinicItem[] }) {
  const [openClinicId, setOpenClinicId] = useState<string | null>(null)

  return (
    <>
      <style>{`
        .clinic-qr-print-sheet {
          display: none;
        }
      `}</style>

      <div className="space-y-4">
        {clinicItems.map((clinic) => {
          const isOpen = openClinicId === clinic.id
          const canPrintQrCodes = Boolean(
            clinic.id &&
              clinic.pickup_verification_code &&
              clinic.delivery_verification_code &&
              clinic.pickup_print_payload &&
              clinic.delivery_print_payload &&
              clinic.pickup_print_qr &&
              clinic.delivery_print_qr
          )

          return (
            <div
              key={clinic.id}
              className={`overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm ${
                clinic.archived_at ? 'opacity-75' : ''
              }`}
            >
              <button
                type="button"
                onClick={() => setOpenClinicId(isOpen ? null : clinic.id)}
                className="flex w-full cursor-pointer items-center justify-between gap-4 px-6 py-5 text-left transition-colors hover:bg-slate-50"
              >
                <div>
                  <h3 className="text-2xl font-semibold text-slate-900">{clinic.name}</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${
                        clinic.is_active
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {clinic.is_active ? 'Active' : 'Inactive'}
                    </span>
                    {clinic.archived_at ? (
                      <span className="inline-flex rounded-full bg-stone-200 px-3 py-1 text-sm font-medium text-stone-700">
                        Archived
                      </span>
                    ) : null}
                  </div>
                </div>
                <span className="text-2xl font-medium text-slate-500">{isOpen ? '−' : '+'}</span>
              </button>

              {isOpen ? (
                <div className="border-t border-slate-200 px-6 py-6">
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    Clinics cannot be deleted once created. Deactivate instead to preserve historical records.
                  </div>

                  <div className="flex flex-wrap justify-end gap-3">
                    {canPrintQrCodes ? (
                      <button
                        type="button"
                        data-print-clinic-qr-button="true"
                        data-clinic-id={clinic.id}
                        className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-800"
                      >
                        Print QR Codes
                      </button>
                    ) : null}

                    <form action={setClinicActive.bind(null, clinic.id, !clinic.is_active)}>
                      <button
                        type="submit"
                        className={`rounded-lg px-4 py-2 font-medium ${
                          clinic.is_active
                            ? 'bg-slate-200 text-slate-900 hover:bg-slate-300'
                            : 'bg-emerald-900 text-white hover:bg-emerald-800'
                        }`}
                      >
                        {clinic.is_active ? 'Deactivate Clinic' : 'Activate Clinic'}
                      </button>
                    </form>

                    {!clinic.is_active ? (
                      <form
                        action={archiveClinicAdmin.bind(null, clinic.id)}
                        onSubmit={(event) => {
                          if (
                            clinic.archived_at ||
                            window.confirm(
                              'Archive this clinic? This will hide it from active use but preserve all records.'
                            )
                          ) {
                            return
                          }

                          event.preventDefault()
                        }}
                      >
                        <button
                          type="submit"
                          disabled={Boolean(clinic.archived_at)}
                          className="rounded-lg bg-stone-200 px-4 py-2 font-medium text-stone-800 hover:bg-stone-300 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-500"
                        >
                          {clinic.archived_at ? 'Archived' : 'Archive Clinic'}
                        </button>
                      </form>
                    ) : null}
                  </div>

                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    <div>
                      <div className="text-sm font-medium text-slate-500">Pickup Code</div>
                      <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-base font-semibold text-slate-900">
                        {clinic.pickup_verification_code || 'Not generated'}
                      </div>
                      {clinic.pickup_qr ? (
                        <img
                          src={clinic.pickup_qr}
                          alt={`${clinic.name} pickup QR`}
                          className="mt-3 h-auto max-w-[120px]"
                        />
                      ) : null}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-slate-500">Delivery Code</div>
                      <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-base font-semibold text-slate-900">
                        {clinic.delivery_verification_code || 'Not generated'}
                      </div>
                      {clinic.delivery_qr ? (
                        <img
                          src={clinic.delivery_qr}
                          alt={`${clinic.name} delivery QR`}
                          className="mt-3 h-auto max-w-[120px]"
                        />
                      ) : null}
                    </div>
                  </div>

                  {canPrintQrCodes ? (
                    <div
                      className="clinic-qr-print-sheet"
                      data-print-clinic-sheet={clinic.id}
                    >
                      <section className="clinic-qr-sheet">
                        <div className="clinic-qr-sheet-card">
                          <div className="clinic-qr-sheet-header">
                            <div className="clinic-qr-sheet-eyebrow">Horizon Clinic QR Sheet</div>
                            <h1 className="clinic-qr-sheet-title">{clinic.name}</h1>
                          </div>

                          <div className="clinic-qr-sheet-grid">
                            <div className="clinic-qr-block">
                              <div className="clinic-qr-block-label">Pickup QR</div>
                              <img
                                src={clinic.pickup_print_qr || ''}
                                alt={`${clinic.name} pickup print QR`}
                                className="clinic-qr-block-image"
                              />
                              <div className="clinic-qr-block-text">
                                {clinic.pickup_print_payload}
                              </div>
                            </div>

                            <div className="clinic-qr-block">
                              <div className="clinic-qr-block-label">Delivery QR</div>
                              <img
                                src={clinic.delivery_print_qr || ''}
                                alt={`${clinic.name} delivery print QR`}
                                className="clinic-qr-block-image"
                              />
                              <div className="clinic-qr-block-text">
                                {clinic.delivery_print_payload}
                              </div>
                            </div>
                          </div>
                        </div>
                      </section>
                    </div>
                  ) : null}

                  <div className="mt-6">
                    <div className="text-sm font-medium text-slate-500">Clinic Users</div>
                    <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      {clinic.linked_users.length > 0 ? (
                        <div className="space-y-4">
                          {clinic.linked_users.map((linkedUser) => (
                            <div key={linkedUser.user_id} className="rounded-xl border border-slate-200 bg-white p-4">
                              <div className="text-sm font-medium text-slate-900">
                                {linkedUser.email || 'Unknown email'}
                              </div>
                              <ClinicUserPasswordForm
                                userId={linkedUser.user_id}
                                email={linkedUser.email}
                              />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <form
                          action={async (formData: FormData) => {
                            await saveClinicAdmin(formData)
                          }}
                          className="flex flex-col gap-3 md:flex-row md:items-center"
                        >
                          <input type="hidden" name="clinic_id" value={clinic.id} />
                          <input
                            name="email"
                            type="email"
                            required
                            placeholder="Clinic login email"
                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 md:max-w-xs"
                          />
                          <input
                            name="password"
                            type="password"
                            minLength={8}
                            required
                            placeholder="Initial password"
                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 md:max-w-xs"
                          />
                          <button
                            type="submit"
                            className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white"
                          >
                            Create Login
                          </button>
                        </form>
                      )}
                    </div>
                  </div>

                  <div className="mt-6">
                    <div className="text-sm font-medium text-slate-500">Clinic Exit PIN</div>
                    <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <ClinicExitPinForm clinicId={clinic.id} />
                    </div>
                  </div>

                  <div className="mt-6">
                    <ClinicForm clinic={clinic} />
                  </div>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>

      <Script id="clinic-qr-print-handler" strategy="afterInteractive">
        {`
          (() => {
            if (document.body.dataset.clinicQrPrintBound === 'true') {
              return;
            }

            document.body.dataset.clinicQrPrintBound = 'true';

            document.addEventListener('click', (event) => {
              const target = event.target;
              if (!(target instanceof Element)) {
                return;
              }

              const button = target.closest('[data-print-clinic-qr-button]');
              if (!button) {
                return;
              }

              const clinicId = button.getAttribute('data-clinic-id');
              if (!clinicId) {
                return;
              }

              const source = document.querySelector(\`[data-print-clinic-sheet="\${clinicId}"]\`);
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
                    <title>Clinic QR Codes</title>
                    <style>
                      @page {
                        margin: 0.4in;
                      }

                      html, body {
                        margin: 0;
                        padding: 0;
                        background: #fff;
                        color: #0f172a;
                        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                      }

                      .clinic-qr-sheet {
                        padding: 12px;
                      }

                      .clinic-qr-sheet-card {
                        border: 1px solid #cbd5e1;
                        border-radius: 18px;
                        padding: 24px;
                      }

                      .clinic-qr-sheet-header {
                        border-bottom: 1px solid #cbd5e1;
                        padding-bottom: 14px;
                      }

                      .clinic-qr-sheet-eyebrow {
                        font-size: 11px;
                        font-weight: 600;
                        letter-spacing: 0.16em;
                        text-transform: uppercase;
                        color: #64748b;
                      }

                      .clinic-qr-sheet-title {
                        margin: 8px 0 0;
                        font-size: 30px;
                        line-height: 1.1;
                        font-weight: 700;
                        color: #0f172a;
                      }

                      .clinic-qr-sheet-grid {
                        margin-top: 24px;
                        display: grid;
                        grid-template-columns: repeat(2, minmax(0, 1fr));
                        gap: 20px;
                      }

                      .clinic-qr-block {
                        border: 1px solid #e2e8f0;
                        border-radius: 18px;
                        padding: 18px;
                        text-align: center;
                      }

                      .clinic-qr-block-label {
                        font-size: 12px;
                        font-weight: 600;
                        letter-spacing: 0.08em;
                        text-transform: uppercase;
                        color: #64748b;
                      }

                      .clinic-qr-block-image {
                        display: block;
                        width: 220px;
                        max-width: 100%;
                        margin: 18px auto 0;
                      }

                      .clinic-qr-block-text {
                        margin-top: 14px;
                        font-size: 12px;
                        line-height: 1.4;
                        color: #475569;
                        word-break: break-all;
                      }

                      @media print {
                        .clinic-qr-sheet {
                          padding: 0;
                        }
                      }

                      @media (max-width: 700px) {
                        .clinic-qr-sheet-grid {
                          grid-template-columns: 1fr;
                        }
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
  )
}
