'use client'

import { useState } from 'react'

import { addCaseEvent } from '@/app/actions/add-case-event'
import { formatCaseEventType } from '@/lib/case-events'
import {
  getCurrentWorkflowStep,
  getNextAllowedEventType,
  getOrderedOperationalEventTypes,
  isCaseWorkflowComplete,
  type CaseWorkflowEventLike,
} from '@/lib/case-workflow'
import { supabase } from '@/lib/supabase/client'

type LoadedCase = {
  id: string
  case_number: string
  cremation_type: string | null
}

type LoadedCaseEvent = {
  id: string
  event_type: string
  created_at: string
  created_by: string | null
  metadata?: Record<string, unknown> | null
}

function getCompletionCodeForEvent(eventType: string): string {
  return `${eventType}_completed`
}

function isStorageReturnCode(scan: string): boolean {
  return scan.endsWith('_storage')
}

async function loadCaseWithEvents(caseNumber: string) {
  const { data: caseItem, error: caseError } = await supabase
    .from('cases')
    .select('id, case_number, cremation_type')
    .eq('case_number', caseNumber)
    .single()

  if (caseError || !caseItem) {
    throw new Error(caseError?.message || 'Case not found.')
  }

  const { data: caseEvents, error: caseEventsError } = await supabase
    .from('case_events')
    .select('id, event_type, created_at, created_by, metadata')
    .eq('case_id', caseItem.id)
    .order('created_at', { ascending: true })

  if (caseEventsError) {
    throw new Error(caseEventsError.message)
  }

  return {
    caseItem: caseItem as LoadedCase,
    caseEvents: (caseEvents ?? []) as LoadedCaseEvent[],
  }
}

export default function ScanPage() {
  const [scanValue, setScanValue] = useState('')
  const [loadedCase, setLoadedCase] = useState<LoadedCase | null>(null)
  const [caseEvents, setCaseEvents] = useState<LoadedCaseEvent[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [scanMode, setScanMode] = useState<
    'waiting_for_case' | 'case_loaded' | 'processing_action'
  >('waiting_for_case')
  const [pendingSwitchCaseNumber, setPendingSwitchCaseNumber] = useState<string | null>(null)

  const workflowOptions = { cremationType: loadedCase?.cremation_type ?? null }
  const currentWorkflowStep = getCurrentWorkflowStep(caseEvents, workflowOptions)
  const nextRequiredEvent = getNextAllowedEventType(caseEvents, workflowOptions)
  const workflowComplete = isCaseWorkflowComplete(caseEvents, workflowOptions)
  const orderedWorkflowSteps = getOrderedOperationalEventTypes(workflowOptions)
  const nextRequiredIndex = nextRequiredEvent
    ? orderedWorkflowSteps.indexOf(nextRequiredEvent)
    : -1
  const upcomingStep =
    nextRequiredIndex >= 0 && nextRequiredIndex + 1 < orderedWorkflowSteps.length
      ? orderedWorkflowSteps[nextRequiredIndex + 1]
      : null

  function handleResetScan() {
    setLoadedCase(null)
    setCaseEvents([])
    setError(null)
    setScanValue('')
    setScanMode('waiting_for_case')
    setPendingSwitchCaseNumber(null)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const scannedValue = scanValue.trim()

    if (!scannedValue || isSubmitting) {
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      if (!loadedCase) {
        const result = await loadCaseWithEvents(scannedValue)
        setLoadedCase(result.caseItem)
        setCaseEvents(result.caseEvents)
        setScanMode('case_loaded')
        setPendingSwitchCaseNumber(null)
        setScanValue('')
        return
      }

      if (isStorageReturnCode(scannedValue)) {
        const pendingCaseNumber = pendingSwitchCaseNumber
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (loadedCase) {
          await addCaseEvent(loadedCase.id, 'status_updated', {
            created_by: user?.id ?? null,
            metadata: {
              location: scannedValue,
            },
          })
        }

        setLoadedCase(null)
        setCaseEvents([])
        setError(null)
        setScanValue('')
        setScanMode('waiting_for_case')

        if (pendingCaseNumber) {
          const switchedCase = await loadCaseWithEvents(pendingCaseNumber)
          setLoadedCase(switchedCase.caseItem)
          setCaseEvents(switchedCase.caseEvents)
          setScanMode('case_loaded')
          setPendingSwitchCaseNumber(null)
        }

        return
      }

      const { data: scannedCase, error: scannedCaseError } = await supabase
        .from('cases')
        .select('case_number')
        .eq('case_number', scannedValue)
        .maybeSingle()

      if (scannedCaseError) {
        throw new Error(scannedCaseError.message)
      }

      if (scannedCase && scannedCase.case_number !== loadedCase.case_number) {
        setPendingSwitchCaseNumber(scannedCase.case_number)
        throw new Error(
          'Return the active pet to storage before switching cases. Scan storage QR for the current pet.'
        )
      }

      setScanMode('processing_action')

      if (!nextRequiredEvent) {
        throw new Error('Workflow complete. No further action scans are accepted.')
      }

      const expectedCompletionCode = getCompletionCodeForEvent(nextRequiredEvent)

      if (scannedValue !== expectedCompletionCode) {
        throw new Error(
          `Invalid completion scan. Expected ${expectedCompletionCode}, received ${scannedValue}`
        )
      }

      const {
        data: { user },
      } = await supabase.auth.getUser()

      await addCaseEvent(loadedCase.id, nextRequiredEvent, {
        created_by: user?.id ?? null,
        metadata: {},
      })

      const refreshed = await loadCaseWithEvents(loadedCase.case_number)
      setLoadedCase(refreshed.caseItem)
      setCaseEvents(refreshed.caseEvents)
      setScanMode('case_loaded')
      setPendingSwitchCaseNumber(null)
      setScanValue('')
    } catch (submitError) {
      if (loadedCase) {
        setScanMode('case_loaded')
      }
      setError(
        submitError instanceof Error ? submitError.message : 'Unable to process scan.'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f3ee] px-6 py-8 md:px-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="rounded-[28px] bg-white p-8 shadow-sm">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
            Scan Runtime
          </h1>
          <p className="mt-3 text-lg text-slate-500">
            Scan a pet QR to load a case. After that, complete the next step and scan its
            completion code.
          </p>

          <div className="mt-6 whitespace-pre-line rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
            {pendingSwitchCaseNumber && loadedCase
              ? `Active pet must be returned to storage before switching to ${pendingSwitchCaseNumber}`
              : scanMode === 'waiting_for_case'
              ? 'Scan pet QR to begin'
              : scanMode === 'processing_action'
                ? 'Processing completion...'
                : `${`Current step: ${
                    currentWorkflowStep ? formatCaseEventType(currentWorkflowStep) : 'None'
                  }\nNext step: ${
                    nextRequiredEvent ? formatCaseEventType(nextRequiredEvent) : 'Complete'
                  }${
                    upcomingStep ? `\nUpcoming: ${formatCaseEventType(upcomingStep)}` : ''
                  }\n\nComplete ${
                    nextRequiredEvent ? formatCaseEventType(nextRequiredEvent) : 'Complete'
                  }, then scan: ${
                    nextRequiredEvent ? getCompletionCodeForEvent(nextRequiredEvent) : 'Complete'
                  }`}`}
          </div>

          <div className="mt-4 flex gap-3">
            <form onSubmit={handleSubmit} className="flex-1">
              <input
                type="text"
                value={scanValue}
                onChange={(event) => setScanValue(event.target.value)}
                placeholder="Scan barcode…"
                autoFocus
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-lg text-slate-900"
              />
            </form>
            <button
              type="button"
              onClick={handleResetScan}
              className="rounded-xl bg-slate-200 px-4 py-3 text-sm font-medium text-slate-900 hover:bg-slate-300"
            >
              Reset scan
            </button>
          </div>

          {error ? (
            <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
          ) : null}
        </section>

        <section className="rounded-[28px] bg-white p-8 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="text-sm font-medium text-slate-500">Case number</div>
              <div className="text-lg font-semibold text-slate-900">
                {loadedCase?.case_number ?? '—'}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-slate-500">Current workflow step</div>
              <div className="text-lg font-semibold text-slate-900">
                {currentWorkflowStep ? formatCaseEventType(currentWorkflowStep) : 'None'}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-slate-500">Next required event</div>
              <div className="text-lg font-semibold text-slate-900">
                {nextRequiredEvent ? formatCaseEventType(nextRequiredEvent) : 'Complete'}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-slate-500">Workflow complete</div>
              <div className="text-lg font-semibold text-slate-900">
                {workflowComplete ? 'Yes' : 'No'}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
