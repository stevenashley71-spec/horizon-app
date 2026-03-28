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
  memorialItems?: Array<{
    id?: string
    name: string
    qty?: number
    price?: number
  }>
  selectedUrn?: string
  selectedUrnName?: string
  soulburstItems?: Array<{
    id?: string
    name: string
    qty?: number
    price?: number
  }>
}

function getInitialSelectedUrnId({
  savedCaseData,
  urnProducts,
}: {
  savedCaseData: { selectedUrn?: unknown; cremationType?: unknown }
  urnProducts: ClinicAvailableProduct[]
}) {
  if (typeof savedCaseData.selectedUrn === 'string' && savedCaseData.selectedUrn) {
    return savedCaseData.selectedUrn
  }

  if (savedCaseData.cremationType !== 'private') {
    return ''
  }

  const includedUrn = urnProducts.find((urn) => urn.includedByDefault)
  return includedUrn?.id ?? ''
}

export function UrnsForm({
  clinicId,
  clinicName,
  urnProducts,
  soulburstProducts,
  loadError,
}: {
  clinicId: string
  clinicName: string
  urnProducts: ClinicAvailableProduct[]
  soulburstProducts: ClinicAvailableProduct[]
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

  const [selectedUrn, setSelectedUrn] = useState<string>('')
  const [extraUrnQty, setExtraUrnQty] = useState<Record<string, string>>({})
  const [soulburstQty, setSoulburstQty] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

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

    if (parsed.cremationType === 'general') {
      router.push('/summary')
      return
    }

    setSelectedUrn(
      getInitialSelectedUrnId({
        savedCaseData: parsed,
        urnProducts,
      })
    )
    setSoulburstQty(
      Object.fromEntries(
        ((parsed.soulburstItems ?? []) as Array<{ id?: string; qty?: number }>)
          .filter((item) => item.id)
          .map((item) => [item.id as string, String(item.qty ?? 1)])
      )
    )
  }, [clinicId, clinicName, router, urnProducts])

  function handleContinue() {
    if (urnProducts.length > 0 && !selectedUrn) {
      setError('Please select a primary urn before continuing.')
      return
    }

    let subtotal = 0
    subtotal += (caseData.memorialItems ?? []).reduce(
      (sum, item) => sum + (item.price ?? 0) * (item.qty ?? 1),
      0
    )

    const selectedUrnData = urnProducts.find((urn) => urn.id === selectedUrn)
    if (selectedUrnData) {
      subtotal += selectedUrnData.price
    }

    Object.entries(extraUrnQty).forEach(([urnId, qty]) => {
      const qtyNum = parseInt(qty)
      if (qtyNum > 0) {
        const urnData = urnProducts.find((urn) => urn.id === urnId)
        if (urnData) {
          subtotal += urnData.price * qtyNum
        }
      }
    })

    Object.entries(soulburstQty).forEach(([itemId, qty]) => {
      const qtyNum = parseInt(qty)
      if (qtyNum > 0) {
        const itemData = soulburstProducts.find((item) => item.id === itemId)
        if (itemData) {
          subtotal += itemData.price * qtyNum
        }
      }
    })

    const total = subtotal
    const additionalUrns = Object.entries(extraUrnQty)
      .map(([urnId, qty]) => {
        const quantity = parseInt(qty)
        if (quantity <= 0) {
          return null
        }

        const urnData = urnProducts.find((urn) => urn.id === urnId)
        if (!urnData) {
          return null
        }

        return {
          id: urnData.id,
          name: urnData.name,
          qty: quantity,
          price: urnData.price,
        }
      })
      .filter(Boolean)

    const selectedSoulbursts = Object.entries(soulburstQty)
      .map(([productId, qty]) => {
        const quantity = parseInt(qty)
        if (quantity <= 0) {
          return null
        }

        const productData = soulburstProducts.find((item) => item.id === productId)
        if (!productData) {
          return null
        }

        return {
          id: productData.id,
          name: productData.name,
          qty: quantity,
          price: productData.price,
        }
      })
      .filter(Boolean)

    const updatedCase = {
      ...caseData,
      clinicId,
      clinicName,
      selectedUrn,
      selectedUrnName: selectedUrnData?.name,
      extraUrnQty,
      soulburstQty,
      additionalUrns,
      soulburstItems: selectedSoulbursts,
      pricing: {
        subtotal,
        total,
      },
    }

    localStorage.setItem('horizonCase', JSON.stringify(updatedCase))
    setError(null)
    router.push('/summary')
  }

  function QuantitySelect({
    value,
    onChange,
    label = 'Qty',
  }: {
    value: string
    onChange: (value: string) => void
    label?: string
  }) {
    return (
      <div className="mt-4">
        <div className="mb-2 text-sm font-medium text-slate-500">{label}</div>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-lg"
        >
          <option value="0">0</option>
          <option value="1">1</option>
          <option value="2">2</option>
          <option value="3">3</option>
          <option value="4">4</option>
        </select>
      </div>
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

            <div className="flex items-center gap-4 text-lg font-medium text-emerald-800">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 font-bold">3</div>
              In-House Memorials
            </div>

            <div className="flex items-center gap-4 rounded-[18px] bg-[#e8eeea] px-4 py-4 text-2xl font-semibold text-emerald-900">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-900 font-bold text-white">4</div>
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
                <div className="font-bold">Private</div>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <h1 className="text-4xl font-bold">Urns & SoulBursts</h1>
            <p className="text-lg text-slate-500">
              Select one primary urn and any optional additional urns or SoulBursts items.
            </p>
          </div>

          {loadError ? (
            <div className="mt-8 rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-700">
              {loadError}
            </div>
          ) : urnProducts.length === 0 && soulburstProducts.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-slate-600">
              No urn or SoulBursts products are currently available for this clinic.
            </div>
          ) : (
            <>
              <section className="mt-8">
                <h2 className="text-2xl font-semibold text-slate-900">Primary Urn Selection</h2>

                {urnProducts.length === 0 ? (
                  <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-slate-600">
                    No urn products are currently available for this clinic.
                  </div>
                ) : (
                  <div className="mt-6 grid gap-6 md:grid-cols-3">
                    {urnProducts.map((item) => {
                      const isSelected = selectedUrn === item.id

                      return (
                        <button
                          key={item.id}
                          onClick={() => setSelectedUrn(item.id)}
                          className={`rounded-2xl border p-5 text-left ${
                            isSelected
                              ? 'border-emerald-700 ring-2 ring-emerald-200'
                              : 'border-slate-200'
                          }`}
                        >
                          <div className="flex h-40 items-center justify-center rounded-xl bg-slate-100 font-semibold text-slate-500">
                            {item.imageUrl ? (
                              <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
                            ) : (
                              item.name
                            )}
                          </div>

                          <div className="mt-4 flex flex-wrap items-center gap-2">
                            {isSelected ? (
                              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
                                Selected
                              </span>
                            ) : null}
                          </div>

                          <div className="mt-4 text-2xl font-bold">{item.name}</div>
                          <div className="mt-2 text-xl font-semibold text-emerald-900">
                            ${item.price.toFixed(2)}
                          </div>

                          <QuantitySelect
                            label="Additional Urns"
                            value={extraUrnQty[item.id] ?? '0'}
                            onChange={(value) =>
                              setExtraUrnQty((prev) => ({ ...prev, [item.id]: value }))
                            }
                          />
                        </button>
                      )
                    })}
                  </div>
                )}
              </section>

              <section className="mt-10">
                <h2 className="text-2xl font-semibold text-slate-900">SoulBursts</h2>
                <p className="mt-2 text-slate-500">
                  Optional keepsake jewelry using your pet&apos;s cremated remains.
                </p>

                {soulburstProducts.length === 0 ? (
                  <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-slate-600">
                    No SoulBursts products are currently available for this clinic.
                  </div>
                ) : (
                  <div className="mt-6 grid gap-6 md:grid-cols-2">
                    {soulburstProducts.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-2xl border border-slate-200 p-5 text-left"
                      >
                        <div className="flex h-40 items-center justify-center rounded-xl bg-slate-100 font-semibold text-slate-500">
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
                          ) : (
                            item.name
                          )}
                        </div>

                        <div className="mt-4 text-2xl font-bold">{item.name}</div>
                        <div className="mt-2 text-xl font-semibold text-emerald-900">
                          ${item.price.toFixed(2)}
                        </div>

                        <QuantitySelect
                          label="Quantity"
                          value={soulburstQty[item.id] ?? '0'}
                          onChange={(value) =>
                            setSoulburstQty((prev) => ({ ...prev, [item.id]: value }))
                          }
                        />
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}

          {error ? (
            <div className="mt-6 rounded-lg bg-rose-100 p-4 text-rose-700">
              {error}
            </div>
          ) : null}

          <div className="mt-10 flex justify-between border-t pt-6">
            <button
              onClick={() => router.push('/memorials')}
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
