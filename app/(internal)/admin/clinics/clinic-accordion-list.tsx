'use client'

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
    <div className="space-y-4">
      {clinicItems.map((clinic) => {
        const isOpen = openClinicId === clinic.id

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

                <div className="flex justify-end gap-3">
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
  )
}
