'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { updateCaseStatus } from '@/app/actions/update-case-status'
import { formatCaseStatus } from '@/lib/case-status'

type StatusFormState = {
  error: string | null
  success: string | null
}

const initialState: StatusFormState = {
  error: null,
  success: null,
}

function SubmitButton({ disabled = false }: { disabled?: boolean }) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="rounded-lg bg-emerald-900 px-4 py-2 text-white transition-colors hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? 'Updating...' : 'Update Status'}
    </button>
  )
}

export function StatusUpdateForm({
  id,
  currentStatus,
  nextStatuses,
  disabled = false,
}: {
  id: string
  currentStatus: string
  nextStatuses: string[]
  disabled?: boolean
}) {
  const [state, formAction] = useActionState(
    async (_previousState: StatusFormState, formData: FormData): Promise<StatusFormState> => {
      const status = formData.get('status')

      if (typeof status !== 'string' || !status) {
        return { error: 'Please select a valid status.', success: null }
      }

      try {
        await updateCaseStatus(id, status)
        return { error: null, success: 'Status updated successfully.' }
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : 'Failed to update status.',
          success: null,
        }
      }
    },
    initialState
  )

  if (nextStatuses.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-slate-600">
          No further transitions are available from {formatCaseStatus(currentStatus)}.
        </p>
        {state.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
        {state.success ? <p className="text-sm text-emerald-700">{state.success}</p> : null}
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <label htmlFor="status" className="text-lg font-medium text-slate-900">
          Status
        </label>
        <select
          id="status"
          name="status"
          defaultValue={nextStatuses[0]}
          disabled={disabled}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-slate-900"
        >
          {nextStatuses.map((status) => (
            <option key={status} value={status}>
              {formatCaseStatus(status)}
            </option>
          ))}
        </select>
        <SubmitButton disabled={disabled} />
      </div>

      {state.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-emerald-700">{state.success}</p> : null}
    </form>
  )
}
