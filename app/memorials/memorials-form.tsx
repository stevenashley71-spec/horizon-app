'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import type { ClinicAvailableProduct } from '@/lib/clinic-product-catalog'

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

export function MemorialsForm({
  clinicId,
  clinicName,
  memorialProducts,
  shouldSkipToSummary,
  loadError,
}: {
  clinicId: string
  clinicName: string
  memorialProducts: ClinicAvailableProduct[]
  shouldSkipToSummary: boolean
  loadError: string | null
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
    cremationType: 'private',
  })
  const [selectedMemorialQty, setSelectedMemorialQty] = useState<Record<string, string>>({})

  useEffect(() => {
    const saved = localStorage.getItem('horizonCase')
    if (!saved) {
      return
    }

    const parsed = JSON.parse(saved)
    setCaseData({
      ...parsed,
      clinicId,
      clinicName,
    })

    const existingSelections = Object.fromEntries(
      ((parsed.memorialItems ?? []) as Array<{ id?: string; qty?: number }>)
        .filter((item) => item.id)
        .map((item) => [item.id as string, String(item.qty ?? 1)])
    )

    setSelectedMemorialQty(existingSelections)
  }, [clinicId, clinicName])

  function handleContinue() {
    const memorialItems = memorialProducts
      .map((item) => {
        const quantity = Number(selectedMemorialQty[item.id] ?? '0')

        if (quantity <= 0) {
          return null
        }

        return {
          id: item.id,
          name: item.name,
          qty: quantity,
          price: item.price,
        }
      })
      .filter(Boolean)

    const subtotal = memorialItems.reduce(
      (sum, item) => sum + (item?.price ?? 0) * (item?.qty ?? 1),
      0
    )

    const updatedCase = {
      ...caseData,
      clinicId,
      clinicName,
      memorialItems,
      pricing: {
        subtotal,
        total: subtotal,
      },
    }

    localStorage.setItem('horizonCase', JSON.stringify(updatedCase))

    if (caseData.cremationType === 'general' || shouldSkipToSummary) {
      router.push('/summary')
      return
    }

    router.push('/urns')
  }

  function QuantitySelect({
    value,
    onChange,
  }: {
    value: string
    onChange: (value: string) => void
  }) {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-xl border px-4 py-3 text-lg bg-white"
      >
        <option value="0">Qty 0</option>
        <option value="1">Qty 1</option>
        <option value="2">Qty 2</option>
        <option value="3">Qty 3</option>
        <option value="4">Qty 4</option>
      </select>
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

            <div className="flex items-center gap-4 text-lg font-medium text-emerald-800">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 font-bold">2</div>
              Cremation Wishes
            </div>

            <div className="flex items-center gap-4 rounded-[18px] bg-[#e8eeea] px-4 py-4 text-2xl font-semibold text-emerald-900">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-900 font-bold text-white">3</div>
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
                  {caseData.cremationType === 'general' ? 'General' : 'Private'}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <h1 className="text-4xl font-bold">In-House Memorial Items</h1>
            <p className="text-lg text-slate-500">
              Select memorial items created in-house before moving forward.
            </p>
          </div>

          {loadError ? (
            <div className="mt-8 rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-700">
              {loadError}
            </div>
          ) : memorialProducts.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-slate-600">
              No memorial products are currently available for this clinic.
            </div>
          ) : (
            <div className="mt-8 space-y-6">
              {memorialProducts.map((item) => {
                const quantity = selectedMemorialQty[item.id] ?? '0'
                const isSelected = Number(quantity) > 0

                return (
                  <div key={item.id} className="rounded-2xl border border-slate-200 p-6">
                    <div className="grid gap-6 md:grid-cols-[180px_1fr_auto] md:items-center">
                      <div className="flex h-32 items-center justify-center overflow-hidden rounded-xl bg-slate-100 font-semibold text-slate-500">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
                        ) : (
                          item.name
                        )}
                      </div>
                      <div>
                        <div className="text-2xl font-bold">{item.name}</div>
                        <p className="mt-2 text-slate-500">{item.description || 'Clinic-configured memorial item.'}</p>
                        <div className="mt-3 text-xl font-semibold text-emerald-900">
                          ${item.price.toFixed(2)}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <QuantitySelect
                          value={quantity}
                          onChange={(value) =>
                            setSelectedMemorialQty((prev) => ({ ...prev, [item.id]: value }))
                          }
                        />
                        <button
                          onClick={() =>
                            setSelectedMemorialQty((prev) => ({
                              ...prev,
                              [item.id]: isSelected ? '0' : prev[item.id] ?? '1',
                            }))
                          }
                          className={`rounded-xl px-5 py-3 font-semibold ${
                            isSelected ? 'bg-emerald-900 text-white' : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {isSelected ? 'Selected' : 'Add'}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div className="mt-10 flex justify-between border-t pt-6">
            <button
              onClick={() => router.push('/cremation')}
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
