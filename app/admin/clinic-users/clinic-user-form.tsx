'use client'

import { useActionState } from 'react'

import { createClinicUserAdmin } from '@/app/actions/admin-clinic-users'

type ClinicOption = {
  id: string
  name: string
}

type ClinicUserFormState = {
  error: string | null
  success: string | null
}

const initialState: ClinicUserFormState = {
  error: null,
  success: null,
}

export function ClinicUserForm({ clinics }: { clinics: ClinicOption[] }) {
  const [state, formAction] = useActionState(
    async (_previousState: ClinicUserFormState, formData: FormData): Promise<ClinicUserFormState> => {
      try {
        const result = await createClinicUserAdmin(formData)
        return {
          error: null,
          success: `Created clinic login ${result.email} for ${result.clinicName}.`,
        }
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : 'Failed to create clinic user.',
          success: null,
        }
      }
    },
    initialState
  )

  return (
    <form action={formAction} className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-2xl font-semibold text-slate-900">Create Clinic Login</h2>
      <p className="mt-2 text-sm text-slate-500">
        Temporary internal tool for creating clinic auth users and linking them to a clinic.
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-600">Clinic</label>
          <select
            name="clinic_id"
            required
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
          >
            <option value="">Select Clinic</option>
            {clinics.map((clinic) => (
              <option key={clinic.id} value={clinic.id}>
                {clinic.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-600">Email / Username</label>
          <input
            name="email"
            type="email"
            required
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-600">Initial Password</label>
          <input
            name="password"
            type="password"
            required
            minLength={6}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
          />
        </div>
      </div>

      {state.error ? <p className="mt-4 text-sm text-rose-700">{state.error}</p> : null}
      {state.success ? <p className="mt-4 text-sm text-emerald-700">{state.success}</p> : null}

      <div className="mt-6">
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white"
        >
          Create Clinic User
        </button>
      </div>
    </form>
  )
}
