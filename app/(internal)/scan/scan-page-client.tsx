'use client'

import { useState } from 'react'

import { addCaseEvent } from '@/app/actions/add-case-event'
import { loadCaseWithEvents } from '@/app/actions/load-case-with-events'
import { formatCaseEventType } from '@/lib/case-events'
import { supabase } from '@/lib/supabase/client'

type LoadedCase = {
  id: string
  case_number: string
  cremation_type: string | null
  clinic_id: string | null
  pickup_verification_code: string | null
  currentStep: string | null
  nextStep: string | null
  nextStepCompletionCode: string | null
  isComplete: boolean
  allowedNextStepDetails: {
    code: string
    requiresScan: boolean
  }[]
}

type LoadedCaseEvent = {
  id: string
  event_type: string
  created_at: string
  created_by: string | null
  metadata?: Record<string, unknown> | null
}

function isStorageReturnCode(scan: string): boolean {
  return scan.endsWith('_storage')
}

function parseCaseQrScan(scan: string): string | null {
  if (!scan.startsWith('HPC_CASE:')) {
    return null
  }

  const caseNumber = scan.slice('HPC_CASE:'.length).trim()
  return caseNumber || null
}

function parseClinicPickupQrScan(scan: string): {
  clinicId: string
  pickupVerificationCode: string
} | null {
  if (!scan.startsWith('HPC_CLINIC_PICKUP:')) {
    return null
  }

  const parts = scan.split(':')

  if (parts.length !== 3) {
    return null
  }

  const clinicId = parts[1]?.trim() ?? ''
  const pickupVerificationCode = parts[2]?.trim() ?? ''

  if (!clinicId || !pickupVerificationCode) {
    return null
  }

  return {
    clinicId,
    pickupVerificationCode,
  }
}

export default function ScanPageClient() {
  const [scanValue, setScanValue] = useState('')
  const [loadedCase, setLoadedCase] = useState<LoadedCase | null>(null)
  const [caseEvents, setCaseEvents] = useState<LoadedCaseEvent[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [scanMode, setScanMode] = useState<
    'waiting_for_case' | 'case_loaded' | 'processing_action'
  >('waiting_for_case')
  const [pendingSwitchCaseNumber, setPendingSwitchCaseNumber] = useState<string | null>(null)

  const currentStep = loadedCase?.currentStep ?? null
  const nextStep = loadedCase?.nextStep ?? null
  const nextStepCompletionCode = loadedCase?.nextStepCompletionCode ?? null
  const isComplete = loadedCase?.isComplete ?? false
  const stepDetails = loadedCase?.allowedNextStepDetails.find(
    (step) => step.code === nextStep
  )
  const requiresScan = stepDetails?.requiresScan === true
  const upcomingStep = null
  const pickupVerificationInstructions =
    nextStep === 'picked_up'
      ? 'Scan case QR to begin. After that, scan the clinic pickup verification QR.'
      : 'Scan a pet QR to load a case. After that, complete the next step and scan its completion code.'

  function handleResetScan() {
    setLoadedCase(null)
    setCaseEvents([])
    setError(null)
    setScanValue('')
    setScanMode('waiting_for_case')
    setPendingSwitchCaseNumber(null)
  }

  async function tryLoadScannedCase(caseNumber: string) {
    try {
      return await loadCaseWithEvents(caseNumber)
    } catch {
      return null
    }
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
        const parsedClinicPickupScan = parseClinicPickupQrScan(scannedValue)

        if (scannedValue.startsWith('HPC_CLINIC_PICKUP:') && !parsedClinicPickupScan) {
          throw new Error('Invalid clinic pickup verification code.')
        }

        if (parsedClinicPickupScan) {
          throw new Error('Scan case QR first.')
        }

        const scannedCaseNumber = parseCaseQrScan(scannedValue) ?? scannedValue
        const result = await loadCaseWithEvents(scannedCaseNumber)
        setLoadedCase(result.caseItem)
        setCaseEvents(result.caseEvents)
        setScanMode('case_loaded')
        setPendingSwitchCaseNumber(null)
        setScanValue('')
        return
      }

      if (isStorageReturnCode(scannedValue)) {
        const pendingCaseNumber = pendingSwitchCaseNumber

        if (loadedCase) {
          await addCaseEvent(loadedCase.id, 'status_updated')
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

      const parsedClinicPickupScan = parseClinicPickupQrScan(scannedValue)

      if (scannedValue.startsWith('HPC_CLINIC_PICKUP:') && !parsedClinicPickupScan) {
        throw new Error('Invalid clinic pickup verification code.')
      }

      if (parsedClinicPickupScan && nextStep !== 'picked_up') {
        throw new Error(
          'Pickup verification is only valid when the next required step is Picked Up.'
        )
      }

      const parsedCaseNumber = parseCaseQrScan(scannedValue)
      const scannedCaseResult = await tryLoadScannedCase(parsedCaseNumber ?? scannedValue)
      const scannedCase = scannedCaseResult?.caseItem ?? null

      if (scannedCase && scannedCase.case_number !== loadedCase.case_number) {
        setPendingSwitchCaseNumber(scannedCase.case_number)
        throw new Error(
          'Return the active pet to storage before switching cases. Scan storage QR for the current pet.'
        )
      }

      setScanMode('processing_action')

      if (!nextStep) {
        throw new Error('Workflow complete. No further action scans are accepted.')
      }

      if (nextStep === 'picked_up') {
        if (requiresScan && !scannedValue) {
          throw new Error('This step requires a valid scan before completion.')
        }

        if (!parsedClinicPickupScan) {
          throw new Error('Invalid clinic pickup verification code.')
        }

        if (!loadedCase.clinic_id || !loadedCase.pickup_verification_code) {
          throw new Error('No pickup verification code is configured for this clinic.')
        }

        if (parsedClinicPickupScan.clinicId !== loadedCase.clinic_id) {
          throw new Error('Clinic verification code does not match this case’s clinic.')
        }

        if (
          parsedClinicPickupScan.pickupVerificationCode !==
          loadedCase.pickup_verification_code
        ) {
          throw new Error('Invalid pickup verification code for this clinic.')
        }

        await addCaseEvent(loadedCase.id, nextStep, {
          scannedCode: scannedValue,
          scanMode,
        })

        const refreshed = await loadCaseWithEvents(loadedCase.case_number)
        setLoadedCase(refreshed.caseItem)
        setCaseEvents(refreshed.caseEvents)
        setScanMode('case_loaded')
        setPendingSwitchCaseNumber(null)
        setScanValue('')
        return
      }

      const expectedCompletionCode = nextStepCompletionCode

      if (!expectedCompletionCode) {
        throw new Error('No completion scan code is configured for this workflow step.')
      }

      if (scannedValue !== expectedCompletionCode) {
        throw new Error(
          `Invalid completion scan. Expected ${expectedCompletionCode}, received ${scannedValue}`
        )
      }

      if (requiresScan && !scannedValue) {
        throw new Error('This step requires a valid scan before completion.')
      }

        await addCaseEvent(loadedCase.id, nextStep, {
          scannedCode: scannedValue,
          scanMode,
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
    <div className="mx-auto max-w-4xl space-y-6">
        <section className="rounded-[28px] bg-white p-8 shadow-sm">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
            Scan Station
          </h1>
          <p className="mt-3 text-lg text-slate-500">
            {pickupVerificationInstructions}
          </p>

          <div className="mt-6 whitespace-pre-line rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
            {pendingSwitchCaseNumber && loadedCase
              ? `Active pet must be returned to storage before switching to ${pendingSwitchCaseNumber}`
              : scanMode === 'waiting_for_case'
                ? 'Scan pet QR to begin'
                : scanMode === 'processing_action'
                  ? 'Processing completion...'
                  : `${`Current step: ${
                      currentStep ? formatCaseEventType(currentStep) : 'None'
                    }\nNext step: ${
                      nextStep ? formatCaseEventType(nextStep) : 'Complete'
                    }${
                      upcomingStep ? `\nUpcoming: ${formatCaseEventType(upcomingStep)}` : ''
                    }\n\nComplete ${
                      nextStep ? formatCaseEventType(nextStep) : 'Complete'
                    }, then scan: ${
                      nextStep === 'picked_up'
                        ? 'Clinic pickup verification QR'
                        : nextStepCompletionCode ?? 'Complete'
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
                {currentStep ? formatCaseEventType(currentStep) : 'None'}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-slate-500">Next required event</div>
              <div className="text-lg font-semibold text-slate-900">
                {nextStep ? formatCaseEventType(nextStep) : 'Complete'}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-slate-500">Workflow complete</div>
              <div className="text-lg font-semibold text-slate-900">
                {isComplete ? 'Yes' : 'No'}
              </div>
            </div>
          </div>
        </section>
      </div>
  )
}
