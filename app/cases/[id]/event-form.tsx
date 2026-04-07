'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { addCaseEvent } from '@/app/actions/add-case-event'
import { formatCaseEventType } from '@/lib/case-events'

type EventFormState = {
  error: string | null
  success: string | null
}

const initialState: EventFormState = {
  error: null,
  success: null,
}

function getEventButtonLabel(eventType: string) {
  return `Mark as ${formatCaseEventType(eventType)}`
}

function SubmitButton({ eventType }: { eventType: string }) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      name="event_type"
      value={eventType}
      disabled={pending}
      className="rounded-lg bg-slate-900 px-4 py-2 text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? 'Adding...' : getEventButtonLabel(eventType)}
    </button>
  )
}

export function CaseEventForm({
  caseId,
  caseEvents,
  cremationType,
  allowedEventType = null,
  currentStep = null,
  nextStep = null,
  isComplete = false,
}: {
  caseId: string
  caseEvents: Array<{ event_type?: string | null; created_at?: string | null }> | null | undefined
  cremationType?: string | null
  allowedEventType?: string | null
  currentStep?: string | null
  nextStep?: string | null
  isComplete?: boolean
}) {
  const router = useRouter()
  const [state, formAction] = useActionState(
    async (_previousState: EventFormState, formData: FormData): Promise<EventFormState> => {
      const eventType = formData.get('event_type')

      if (typeof eventType !== 'string' || !eventType) {
        return { error: 'Please select a valid event.', success: null }
      }

      try {
        await addCaseEvent(caseId, eventType)
        router.refresh()
        return { error: null, success: 'Event added successfully.' }
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : 'Failed to add event.',
          success: null,
        }
      }
    },
    initialState
  )

  if (isComplete) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-slate-600">Workflow complete. No further events required.</p>
        {state.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
        {state.success ? <p className="text-sm text-emerald-700">{state.success}</p> : null}
      </div>
    )
  }

  if (allowedEventType) {
    if (nextStep !== allowedEventType) {
      return (
        <div className="space-y-2">
          <p className="text-sm text-slate-600">
            The next available workflow event is{' '}
            {nextStep ? formatCaseEventType(nextStep) : 'none'}.
          </p>
          {state.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
          {state.success ? <p className="text-sm text-emerald-700">{state.success}</p> : null}
        </div>
      )
    }

    if (allowedEventType === 'picked_up') {
      return (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 px-4 py-3">
            <div className="text-sm font-medium text-slate-500">Next required event</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">
              {formatCaseEventType(allowedEventType)}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/scan"
              className="rounded-lg bg-slate-900 px-4 py-2 text-white transition-colors hover:bg-slate-800"
            >
              Go to Scan Station for Pickup
            </Link>
          </div>

          {state.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
          {state.success ? <p className="text-sm text-emerald-700">{state.success}</p> : null}
        </div>
      )
    }

    return (
      <form action={formAction} className="space-y-4">
        <div className="rounded-xl border border-slate-200 px-4 py-3">
          <div className="text-sm font-medium text-slate-500">Next required event</div>
          <div className="mt-1 text-sm font-semibold text-slate-900">
            {formatCaseEventType(allowedEventType)}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <SubmitButton eventType={allowedEventType} />
        </div>

        {state.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
        {state.success ? <p className="text-sm text-emerald-700">{state.success}</p> : null}
      </form>
    )
  }

  if (!nextStep) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-slate-600">
          No operational event is currently available.
        </p>
        {state.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
        {state.success ? <p className="text-sm text-emerald-700">{state.success}</p> : null}
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 px-4 py-3">
          <div className="text-sm font-medium text-slate-500">Current workflow step</div>
          <div className="mt-1 text-sm font-semibold text-slate-900">
            {currentStep ? formatCaseEventType(currentStep) : 'None'}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 px-4 py-3">
          <div className="text-sm font-medium text-slate-500">Next required event</div>
          <div className="mt-1 text-sm font-semibold text-slate-900">
            {nextStep ? formatCaseEventType(nextStep) : 'Complete'}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 px-4 py-3">
          <div className="text-sm font-medium text-slate-500">Workflow complete</div>
          <div className="mt-1 text-sm font-semibold text-slate-900">
            {isComplete ? 'Yes' : 'No'}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-lg font-medium text-slate-900">Next Required Event</div>
        <div className="flex flex-wrap gap-3">
          <SubmitButton eventType={nextStep} />
        </div>
      </div>

      {state.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-emerald-700">{state.success}</p> : null}
    </form>
  )
}
