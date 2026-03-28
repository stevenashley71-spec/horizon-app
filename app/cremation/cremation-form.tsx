'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type CaseData = {
  formNumber: string
  dateOpened: string
  clinicId?: string
  clinicName: string
  petName: string
  ownerFirstName: string
  ownerLastName: string
  cremationType: string
}

export function CremationForm({
  clinicId,
  clinicName,
}: {
  clinicId: string
  clinicName: string
}) {
  const router = useRouter()

  const [caseData, setCaseData] = useState<CaseData>({
    formNumber: 'HPC26-165',
    dateOpened: 'March 23, 2026',
    clinicId,
    clinicName,
    petName: 'Buddy',
    ownerFirstName: 'Jamie',
    ownerLastName: 'Carter',
    cremationType: '',
  })

  const [selectedType, setSelectedType] = useState<'private' | 'general' | ''>('')
  const [understandDifference, setUnderstandDifference] = useState(false)
  const [confirmRemains, setConfirmRemains] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const saved = localStorage.getItem('horizonCase')
    if (!saved) {
      return
    }

    const parsed = JSON.parse(saved)
    const nextCaseData = {
      ...parsed,
      clinicId,
      clinicName,
    }

    setCaseData(nextCaseData)
    if (nextCaseData.cremationType) {
      setSelectedType(nextCaseData.cremationType)
    }
  }, [clinicId, clinicName])

  function handleContinue() {
    if (!selectedType) {
      setError('Please select a cremation type.')
      return
    }

    if (!understandDifference) {
      setError('Please acknowledge the cremation type difference.')
      return
    }

    if (selectedType === 'private' && !confirmRemains) {
      setError('Please confirm return of cremated remains.')
      return
    }

    const updatedCase = {
      ...caseData,
      clinicId,
      clinicName,
      cremationType: selectedType,
    }

    localStorage.setItem('horizonCase', JSON.stringify(updatedCase))
    setCaseData(updatedCase)
    setError('')
    router.push('/memorials')
  }

  function CheckIcon() {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4 text-white" fill="none" stroke="currentColor" strokeWidth="3">
        <path d="M5 13l4 4L19 7" />
      </svg>
    )
  }

  return (
    <main className="min-h-screen bg-[#f4f3ee] px-6 py-8 md:px-10">
      <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[320px_1fr]">
        <aside className="rounded-[28px] bg-white p-6 shadow-sm">
          <div className="space-y-4">
            <div className="flex items-center gap-4 text-lg font-medium text-emerald-800">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 font-bold">1</div>
              Pet & Owner
            </div>

            <div className="flex items-center gap-4 rounded-[18px] bg-[#e8eeea] px-4 py-4 text-2xl font-semibold text-emerald-900">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-900 text-white font-bold">2</div>
              Cremation Wishes
            </div>

            <div className="flex items-center gap-4 text-slate-400">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 font-bold">3</div>
              In-House Memorials
            </div>

            <div className="flex items-center gap-4 text-slate-400">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 font-bold">4</div>
              Urns & SoulBursts
            </div>

            <div className="flex items-center gap-4 text-slate-400">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 font-bold">5</div>
              Summary & Signature
            </div>
          </div>
        </aside>

        <section className="rounded-[30px] bg-white p-7 shadow-sm">
          <div className="rounded-[28px] bg-gradient-to-r from-[#1f5a4f] to-[#356d60] p-6 text-white">
            <div className="flex justify-between">
              <div>
                <div className="text-sm uppercase tracking-widest opacity-70">Work Order</div>
                <div className="text-5xl font-bold">{caseData.formNumber}</div>
              </div>

              <div className="text-right">
                <div className="text-sm opacity-70">Date Opened</div>
                <div className="text-2xl font-bold">{caseData.dateOpened}</div>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-4">
              <div className="rounded-xl bg-white/10 p-4">
                <div className="text-sm opacity-70">Clinic</div>
                <div className="font-bold">{caseData.clinicName}</div>
              </div>

              <div className="rounded-xl bg-white/10 p-4">
                <div className="text-sm opacity-70">Pet Name</div>
                <div className="font-bold">{caseData.petName}</div>
              </div>

              <div className="rounded-xl bg-white/10 p-4">
                <div className="text-sm opacity-70">Owner</div>
                <div className="font-bold">
                  {caseData.ownerFirstName} {caseData.ownerLastName}
                </div>
              </div>

              <div className="rounded-xl bg-white/10 p-4">
                <div className="text-sm opacity-70">Cremation Type</div>
                <div className="font-bold">
                  {selectedType === 'general'
                    ? 'General'
                    : selectedType === 'private'
                      ? 'Private'
                      : 'Not Selected'}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <h1 className="text-4xl font-bold">Cremation Wishes</h1>
            <p className="text-lg text-slate-500">
              The client makes an informed selection with plain language descriptions.
            </p>
          </div>

          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <button
              onClick={() => {
                setSelectedType('private')
                setError('')
              }}
              className={`rounded-2xl border p-6 text-left ${
                selectedType === 'private'
                  ? 'border-emerald-700 ring-2 ring-emerald-200'
                  : 'border-slate-200'
              }`}
            >
              <div className="flex h-40 items-center justify-center rounded-xl bg-[#e7e6dc] font-semibold">
                Standard Urn Included
              </div>

              <div className="mt-4 text-2xl font-bold">Private Cremation</div>
              <p className="mt-2 text-slate-500">
                Your pet is cremated individually and returned to you.
              </p>

              <div className="mt-3 text-3xl font-bold text-emerald-900">$285.00</div>
            </button>

            <button
              onClick={() => {
                setSelectedType('general')
                setConfirmRemains(false)
                setError('')
              }}
              className={`rounded-2xl border p-6 text-left ${
                selectedType === 'general'
                  ? 'border-emerald-700 ring-2 ring-emerald-200'
                  : 'border-slate-200'
              }`}
            >
              <div className="flex h-40 items-center justify-center rounded-xl bg-[#eef1ea] font-semibold">
                General Cremation
              </div>

              <div className="mt-4 text-2xl font-bold">General Cremation</div>
              <p className="mt-2 text-slate-500">
                No cremated remains returned.
              </p>

              <div className="mt-3 text-3xl font-bold text-emerald-900">$150.00</div>
            </button>
          </div>

          <div className="mt-8 space-y-4">
            <button
              type="button"
              onClick={() => {
                setUnderstandDifference(!understandDifference)
                setError('')
              }}
              className={`flex w-full items-start gap-4 rounded-xl border p-5 text-left ${
                understandDifference ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200 bg-white'
              }`}
            >
              <div
                className={`mt-1 flex h-7 w-7 items-center justify-center rounded-md border ${
                  understandDifference
                    ? 'border-emerald-700 bg-emerald-700'
                    : 'border-slate-300 bg-white'
                }`}
              >
                {understandDifference && <CheckIcon />}
              </div>

              <div className="text-lg font-medium">
                I understand that Private Cremation returns remains, and General does not.
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                if (selectedType === 'private') {
                  setConfirmRemains(!confirmRemains)
                  setError('')
                }
              }}
              className={`flex w-full items-start gap-4 rounded-xl border p-5 text-left ${
                selectedType !== 'private'
                  ? 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-50'
                  : confirmRemains
                    ? 'border-emerald-600 bg-emerald-50'
                    : 'border-slate-200 bg-white'
              }`}
            >
              <div
                className={`mt-1 flex h-7 w-7 items-center justify-center rounded-md border ${
                  confirmRemains
                    ? 'border-emerald-700 bg-emerald-700'
                    : 'border-slate-300 bg-white'
                }`}
              >
                {confirmRemains && <CheckIcon />}
              </div>

              <div className="text-lg font-medium">
                I confirm that my pet&apos;s cremated remains will be returned with Private Cremation.
              </div>
            </button>
          </div>

          {error ? (
            <div className="mt-6 rounded-lg bg-rose-100 p-4 text-rose-700">
              {error}
            </div>
          ) : null}

          <div className="mt-10 flex justify-between border-t pt-6">
            <button
              onClick={() => router.push('/clinic')}
              className="rounded-lg bg-slate-200 px-6 py-3"
            >
              Back
            </button>

            <button
              onClick={handleContinue}
              className="rounded-lg bg-emerald-900 px-6 py-3 text-white"
            >
              Continue
            </button>
          </div>
        </section>
      </div>
    </main>
  )
}
