'use client'

import { useEffect, useState } from 'react'

import { validateClinicExitPin } from '@/app/actions/validate-clinic-exit-pin'
import type { loadIntakeDraft } from '@/app/actions/intake/load-intake-draft'

import { ClinicIntakeForm } from './clinic-intake-form'

type ClinicIntakeData = Awaited<ReturnType<typeof loadIntakeDraft>>

export function ClinicIntakeStartScreen({
  intake,
  isDirectKioskFlow = false,
}: {
  intake: ClinicIntakeData
  isDirectKioskFlow?: boolean
}) {
  const allowsDonationIntake = Boolean(
    (
      intake?.catalog?.clinic as
        | {
            allows_donation_intake?: boolean
          }
        | undefined
    )?.allows_donation_intake
  )
  const intakeOptions = [
    {
      id: 'standard' as const,
      name: 'Standard',
      description: 'Standard client intake',
    },
    {
      id: 'employee' as const,
      name: 'Employee Pet',
      description: 'Clinic employee personal pet',
    },
    {
      id: 'good_samaritan' as const,
      name: 'Good Samaritan',
      description: 'Unowned or rescued animal',
    },
    ...(allowsDonationIntake
      ? [
          {
            id: 'donation' as const,
            name: 'Donation',
            description: 'No-charge cremation case',
          },
        ]
      : []),
  ]
  const [intakeType, setIntakeType] = useState<
    'standard' | 'employee' | 'good_samaritan' | 'donation'
  >('standard')
  const [hasStarted, setHasStarted] = useState(false)
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [submittedCase, setSubmittedCase] = useState<{ id: string; caseNumber?: string } | null>(
    null
  )
  const [preStartWeight, setPreStartWeight] = useState('')
  const [preStartWeightUnit, setPreStartWeightUnit] = useState<'lbs' | 'kg'>('lbs')
  const [isPinPromptOpen, setIsPinPromptOpen] = useState(false)
  const [enteredPin, setEnteredPin] = useState('')
  const [pinError, setPinError] = useState('')
  const [isSpecialPinPromptOpen, setIsSpecialPinPromptOpen] = useState(false)
  const [specialPinInput, setSpecialPinInput] = useState('')
  const [specialPinError, setSpecialPinError] = useState('')
  const isKioskActive = hasStarted || hasSubmitted
  const canBeginIntake = (() => {
    const numericWeight = Number(preStartWeight)
    return Number.isFinite(numericWeight) && numericWeight > 0
  })()

  useEffect(() => {
    if (!isKioskActive) {
      return
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault()
      event.returnValue = ''
    }

    function handlePopState() {
      if (!isKioskActive) {
        return
      }

      window.history.pushState(null, '', window.location.href)
    }

    window.history.pushState(null, '', window.location.href)
    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('popstate', handlePopState)
    }
  }, [isKioskActive])

  useEffect(() => {
    if (!allowsDonationIntake && intakeType === 'donation') {
      setIntakeType('standard')
    }
  }, [allowsDonationIntake, intakeType])

  function handleOpenPinPrompt() {
    setEnteredPin('')
    setPinError('')
    setIsPinPromptOpen(true)
  }

  function handleCancelPinPrompt() {
    setEnteredPin('')
    setPinError('')
    setIsPinPromptOpen(false)
  }

  async function handleConfirmReset() {
    const isValid = await validateClinicExitPin(enteredPin)

    if (isValid) {
      setHasSubmitted(false)
      setSubmittedCase(null)
      setHasStarted(false)
      setEnteredPin('')
      setPinError('')
      setIsPinPromptOpen(false)
      return
    }

    setPinError('Incorrect PIN')
  }

  function handleBeginIntake() {
    if (!isDirectKioskFlow && intakeType !== 'standard') {
      setSpecialPinInput('')
      setSpecialPinError('')
      setIsSpecialPinPromptOpen(true)
      return
    }

    setHasStarted(true)
  }

  function handleCancelSpecialPin() {
    setIsSpecialPinPromptOpen(false)
    setSpecialPinInput('')
    setSpecialPinError('')
  }

  async function handleConfirmSpecialPin() {
    const isValid = await validateClinicExitPin(specialPinInput)

    if (isValid) {
      setIsSpecialPinPromptOpen(false)
      setSpecialPinInput('')
      setSpecialPinError('')
      setHasStarted(true)
      return
    }

    setSpecialPinError('Incorrect PIN')
  }

  if (hasSubmitted) {
    return (
      <main className="min-h-screen bg-neutral-100 px-6 py-8 md:px-10">
        <div className="mx-auto flex min-h-[70vh] max-w-4xl items-center justify-center">
          <section className="w-full rounded-[28px] bg-white p-10 text-center shadow-sm md:p-14">
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
              Work Order Submitted
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-xl text-slate-500">
              A staff member will assist you shortly.
            </p>
            {submittedCase?.caseNumber ? (
              <p className="mt-6 text-lg font-semibold text-slate-900">
                Case Number: {submittedCase.caseNumber}
              </p>
            ) : null}
            <button
              type="button"
              onClick={handleOpenPinPrompt}
              className="mt-10 rounded-[22px] bg-emerald-900 px-10 py-5 text-2xl text-white transition-colors hover:bg-emerald-800"
            >
              Start Next Intake
            </button>
          </section>
        </div>

        {isPinPromptOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-6 py-8">
            <div className="w-full max-w-md rounded-[28px] bg-white p-8 shadow-2xl">
              <h2 className="text-3xl font-bold tracking-tight text-slate-900">
                Staff Reset Required
              </h2>
              <p className="mt-3 text-base text-slate-500">
                Enter the PIN to clear this screen and begin the next intake.
              </p>

              <div className="mt-6">
                <label className="mb-3 block text-xl font-semibold text-slate-900">PIN</label>
                <input
                  type="password"
                  value={enteredPin}
                  onChange={(e) => {
                    setEnteredPin(e.target.value)
                    setPinError('')
                  }}
                  className="w-full rounded-[22px] border border-slate-200 px-6 py-5 text-2xl"
                  placeholder="Enter PIN"
                />
              </div>

              {pinError ? (
                <div className="mt-4 rounded-xl bg-red-100 p-4 text-base text-red-700">
                  {pinError}
                </div>
              ) : null}

              <div className="mt-6 flex items-center justify-end gap-4">
                <button
                  type="button"
                  onClick={handleCancelPinPrompt}
                  className="rounded-[18px] bg-slate-200 px-6 py-3 text-lg font-medium text-slate-900 transition-colors hover:bg-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReset}
                  className="rounded-[18px] bg-emerald-900 px-6 py-3 text-lg font-medium text-white transition-colors hover:bg-emerald-800"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    )
  }

  if (hasStarted) {
    return (
      <ClinicIntakeForm
        intake={intake}
        intakeType={intakeType}
        isDirectKioskFlow={isDirectKioskFlow}
        kioskInitialWeight={preStartWeight}
        kioskInitialWeightUnit={preStartWeightUnit}
        onExitToStart={() => setHasStarted(false)}
        onSubmitSuccess={(result) => {
          setHasSubmitted(true)
          setSubmittedCase(result)
        }}
      />
    )
  }

  return (
    <main className="min-h-screen bg-neutral-100 px-6 py-8 md:px-10">
      <div className="mx-auto flex min-h-[70vh] max-w-4xl items-center justify-center">
        <section className="w-full rounded-[28px] bg-white p-10 text-center shadow-sm md:p-14">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
            Please review and complete this form
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-xl text-slate-500">
            This intake will guide you through the information Horizon needs to receive,
            review, and confirm this work order before submission.
          </p>
          {!isDirectKioskFlow ? (
            <div className="mx-auto mt-10 max-w-3xl text-left">
              <div>
                <label className="mb-3 block text-xl font-semibold text-slate-900">
                  Intake Type
                </label>
                <p className="text-base text-slate-500">
                  Select the type of intake for this case.
                </p>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {intakeOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setIntakeType(option.id)}
                    className={`rounded-[22px] border px-6 py-5 text-left transition-colors ${
                      intakeType === option.id
                        ? 'border-emerald-600 bg-emerald-50'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <h3 className="text-xl font-semibold text-slate-900">{option.name}</h3>
                    <p className="mt-3 text-base text-slate-500">{option.description}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {isSpecialPinPromptOpen ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-6 py-8">
              <div className="w-full max-w-md rounded-[28px] bg-white p-8 shadow-2xl">
                <h2 className="text-3xl font-bold tracking-tight text-slate-900">
                  Clinic Authorization Required
                </h2>
                <p className="mt-3 text-base text-slate-500">
                  This intake type requires clinic authorization. Enter the clinic PIN to continue.
                </p>

                <div className="mt-6">
                  <label className="mb-3 block text-xl font-semibold text-slate-900">PIN</label>
                  <input
                    type="password"
                    value={specialPinInput}
                    onChange={(e) => {
                      setSpecialPinInput(e.target.value)
                      setSpecialPinError('')
                    }}
                    className="w-full rounded-[22px] border border-slate-200 px-6 py-5 text-2xl"
                    placeholder="Enter PIN"
                  />
                </div>

                {specialPinError ? (
                  <div className="mt-4 rounded-xl bg-red-100 p-4 text-base text-red-700">
                    {specialPinError}
                  </div>
                ) : null}

                <div className="mt-6 flex items-center justify-end gap-4">
                  <button
                    type="button"
                    onClick={handleCancelSpecialPin}
                    className="rounded-[18px] bg-slate-200 px-6 py-3 text-lg font-medium text-slate-900 transition-colors hover:bg-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmSpecialPin}
                    className="rounded-[18px] bg-emerald-900 px-6 py-3 text-lg font-medium text-white transition-colors hover:bg-emerald-800"
                  >
                    Confirm
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="mx-auto mt-10 max-w-xl text-left">
            <label className="mb-3 block text-xl font-semibold text-slate-900">Pet Weight</label>
            <div className="flex gap-3">
              <input
                type="text"
                value={preStartWeight}
                onChange={(e) => setPreStartWeight(e.target.value)}
                className="min-w-0 flex-1 rounded-[22px] border border-slate-200 px-6 py-5 text-2xl text-slate-900"
                placeholder="0.0"
              />
              <select
                value={preStartWeightUnit}
                onChange={(e) => setPreStartWeightUnit(e.target.value as 'lbs' | 'kg')}
                className="w-[140px] rounded-[22px] border border-slate-200 px-5 py-5 text-2xl font-semibold text-slate-900"
              >
                <option value="lbs">lbs</option>
                <option value="kg">kg</option>
              </select>
            </div>
          </div>
          <button
            type="button"
            onClick={handleBeginIntake}
            disabled={!canBeginIntake}
            className="mt-10 rounded-[22px] bg-emerald-900 px-10 py-5 text-2xl text-white transition-colors hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Begin Intake
          </button>
        </section>
      </div>
    </main>
  )
}
