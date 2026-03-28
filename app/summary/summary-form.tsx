'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { saveCase } from '../actions/save-case'

type SummaryData = {
  clinicId?: string
  clinicName?: string
  petName?: string
  species?: string
  petWeight?: string
  breed?: string
  color?: string
  ownerName?: string
  ownerPhone?: string
  ownerEmail?: string
  ownerAddress?: string
  ownerCity?: string
  ownerState?: string
  ownerZip?: string
  cremationType?: string
  selectedUrnName?: string
  selectedUrn?: string | number
  memorialItems?: Array<{
    name: string
    qty?: number
  }>
  soulburstItems?: Array<{
    name: string
    qty?: number
  }>
  pricing?: {
    subtotal?: number
    total?: number
  }
  subtotal?: number
  total?: number
}

export function SummaryForm({
  clinicId,
  clinicName,
}: {
  clinicId: string
  clinicName: string
}) {
  const router = useRouter()

  const [caseData, setCaseData] = useState<SummaryData | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem('caseData') ?? localStorage.getItem('horizonCase')
    if (!saved) {
      return
    }

    try {
      const parsed = JSON.parse(saved)

      const normalizedCaseData: SummaryData = {
        clinicId,
        clinicName,
        petName: parsed.petName,
        species: parsed.species,
        petWeight: parsed.petWeight ?? parsed.weight,
        breed: parsed.breed,
        color: parsed.color,
        ownerName:
          parsed.ownerName ??
          [parsed.ownerFirstName, parsed.ownerLastName].filter(Boolean).join(' '),
        ownerPhone: parsed.ownerPhone ?? parsed.phone,
        ownerEmail: parsed.ownerEmail ?? parsed.email,
        ownerAddress: parsed.ownerAddress ?? parsed.street,
        ownerCity: parsed.ownerCity ?? parsed.city,
        ownerState: parsed.ownerState ?? parsed.state,
        ownerZip: parsed.ownerZip ?? parsed.zip,
        cremationType: parsed.cremationType,
        selectedUrn: parsed.selectedUrn,
        selectedUrnName: parsed.selectedUrnName,
        memorialItems:
          parsed.memorialItems ??
          [
            parsed.memorialSelections?.claySelected
              ? { name: 'Clay Paw Print', qty: Number(parsed.memorialSelections.clayQty ?? 1) }
              : null,
            parsed.memorialSelections?.inkPawSelected
              ? { name: 'Ink Paw Print', qty: Number(parsed.memorialSelections.inkPawQty ?? 1) }
              : null,
            parsed.memorialSelections?.inkNoseSelected
              ? { name: 'Ink Nose Print', qty: Number(parsed.memorialSelections.inkNoseQty ?? 1) }
              : null,
            parsed.memorialSelections?.furSelected
              ? { name: 'Lock of Fur', qty: Number(parsed.memorialSelections.furQty ?? 1) }
              : null,
          ].filter(Boolean) as SummaryData['memorialItems'],
        soulburstItems:
          parsed.soulburstItems ??
          Object.entries(parsed.soulburstQty ?? {})
            .map(([itemId, qty]) => {
              const quantity = Number(qty)
              if (quantity <= 0) {
                return null
              }

              return {
                name: itemId === '101' ? 'SoulBursts Pendant' : 'SoulBursts Keychain',
                qty: quantity,
              }
            })
            .filter(Boolean) as SummaryData['soulburstItems'],
        pricing: parsed.pricing,
        subtotal: parsed.subtotal,
        total: parsed.total,
      }

      setCaseData(normalizedCaseData)
    } catch (err) {
      console.error('Failed to parse caseData from localStorage', err)
    }
  }, [clinicId, clinicName])

  const formatAddress = () => {
    if (!caseData) return ''
    const parts = [
      caseData.ownerAddress,
      caseData.ownerCity,
      caseData.ownerState,
      caseData.ownerZip,
    ].filter(Boolean)
    return parts.join(', ')
  }

  const subtotal = caseData?.pricing?.subtotal ?? caseData?.subtotal ?? 0
  const total = caseData?.pricing?.total ?? caseData?.total ?? 0

  const handleSubmit = async () => {
    if (!caseData) {
      setError('No case data found to submit.')
      return
    }

    setIsSaving(true)
    setSuccess(null)
    setError(null)

    try {
      const payload = {
        clinic_name: clinicName,
        pet_name: caseData.petName ?? '',
        pet_species: caseData.species ?? undefined,
        pet_weight: caseData.petWeight ?? undefined,
        pet_weight_unit: 'lbs',
        pet_weight_lbs: caseData.petWeight ? Number(caseData.petWeight) : undefined,
        pet_breed: caseData.breed ?? undefined,
        pet_color: caseData.color ?? undefined,
        owner_name: caseData.ownerName ?? '',
        owner_phone: caseData.ownerPhone ?? undefined,
        owner_email: caseData.ownerEmail ?? undefined,
        owner_address: caseData.ownerAddress ?? undefined,
        owner_city: caseData.ownerCity ?? undefined,
        owner_state: caseData.ownerState ?? undefined,
        owner_zip: caseData.ownerZip ?? undefined,
        cremation_type: caseData.cremationType ?? undefined,
        selected_urn: caseData.selectedUrnName ?? undefined,
        additional_urns: [],
        soulburst_items: (caseData.soulburstItems ?? []).map((item, index) => ({
          item_id: index + 1,
          item_name: item.name,
          qty: item.qty ?? 1,
        })),
        memorial_items: (caseData.memorialItems ?? []).map((item, index) => ({
          item_id: String(index + 1),
          item_name: item.name,
          qty: item.qty ?? 1,
        })),
        subtotal,
        total,
        case_data: {
          ...caseData,
          clinicId,
          clinicName,
        },
      }

      const result = await saveCase(payload)

      setSuccess(`Case ${result.caseNumber} created successfully`)
      localStorage.removeItem('caseData')
      localStorage.removeItem('horizonCase')
    } catch (err: any) {
      console.error(err)
      setError(err?.message || 'Failed to create case')
    } finally {
      setIsSaving(false)
    }
  }

  if (!caseData) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <h1 className="mb-4 text-5xl font-bold text-slate-900">Case Summary</h1>
        <p className="text-slate-600">No summary data found.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="mb-2 text-5xl font-bold text-slate-900">Case Summary</h1>
      <p className="mb-8 text-xl text-slate-500">
        Review all information before submitting the case.
      </p>

      <div className="space-y-6">
        <section className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="mb-6 text-2xl font-bold text-slate-900">Case Information</h2>
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <p className="text-sm text-slate-500">Case Number</p>
              <p className="text-2xl font-semibold text-slate-900">
                Case number will be assigned upon submission
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Date Opened</p>
              <p className="text-2xl font-semibold text-slate-900">
                {new Date().toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Clinic</p>
              <p className="text-2xl font-semibold text-slate-900">
                {clinicName || 'Not provided'}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="mb-6 text-2xl font-bold text-slate-900">Pet Information</h2>
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <p className="text-sm text-slate-500">Pet Name</p>
              <p className="text-2xl font-semibold text-slate-900">
                {caseData.petName || 'Not provided'}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Species</p>
              <p className="text-2xl font-semibold text-slate-900">
                {caseData.species || 'Not provided'}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Weight</p>
              <p className="text-2xl font-semibold text-slate-900">
                {caseData.petWeight ? `${caseData.petWeight} lbs` : 'Not provided'}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Breed</p>
              <p className="text-2xl font-semibold text-slate-900">
                {caseData.breed || 'Not provided'}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Color</p>
              <p className="text-2xl font-semibold text-slate-900">
                {caseData.color || 'Not provided'}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="mb-6 text-2xl font-bold text-slate-900">Owner Information</h2>
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <p className="text-sm text-slate-500">Owner Name</p>
              <p className="text-2xl font-semibold text-slate-900">
                {caseData.ownerName || 'Not provided'}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Phone</p>
              <p className="text-2xl font-semibold text-slate-900">
                {caseData.ownerPhone || 'Not provided'}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Email</p>
              <p className="text-2xl font-semibold text-slate-900">
                {caseData.ownerEmail || 'Not provided'}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Address</p>
              <p className="text-2xl font-semibold text-slate-900">
                {formatAddress() || 'Not provided'}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="mb-6 text-2xl font-bold text-slate-900">Cremation Type</h2>
          <p className="text-2xl font-semibold text-slate-900">
            {caseData.cremationType || 'Not provided'}
          </p>
        </section>

        <section className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="mb-6 text-2xl font-bold text-slate-900">Urn Selection</h2>
          <div>
            <p className="text-sm text-slate-500">Selected Urn</p>
            <p className="text-2xl font-semibold text-slate-900">
              {caseData.selectedUrnName || 'No urn selected'}
            </p>
          </div>
        </section>

        <section className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="mb-6 text-2xl font-bold text-slate-900">Memorial Items</h2>

          {caseData.memorialItems && caseData.memorialItems.length > 0 ? (
            <div className="space-y-3">
              {caseData.memorialItems.map((item, index) => (
                <div key={`${item.name}-${index}`} className="flex items-center justify-between">
                  <span className="text-xl text-slate-900">{item.name}</span>
                  <span className="text-xl text-slate-700">Qty: {item.qty ?? 1}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xl text-slate-500">No memorial items selected</p>
          )}
        </section>

        <section className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="mb-6 text-2xl font-bold text-slate-900">SoulBursts</h2>

          {caseData.soulburstItems && caseData.soulburstItems.length > 0 ? (
            <div className="space-y-3">
              {caseData.soulburstItems.map((item, index) => (
                <div key={`${item.name}-${index}`} className="flex items-center justify-between">
                  <span className="text-xl text-slate-900">{item.name}</span>
                  <span className="text-xl text-slate-700">Qty: {item.qty ?? 1}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xl text-slate-500">No SoulBursts selected</p>
          )}
        </section>

        <section className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="mb-6 text-2xl font-bold text-slate-900">Pricing Summary</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xl text-slate-900">
              <span>Subtotal:</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="border-t border-slate-300 pt-4">
              <div className="flex items-center justify-between text-3xl font-bold text-slate-900">
                <span>Total:</span>
                <span>${total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="mt-10 flex items-center justify-between border-t border-slate-300 pt-8">
        <button
          type="button"
          onClick={() => router.push('/urns')}
          className="rounded-xl bg-slate-200 px-6 py-3 text-lg font-medium text-slate-800"
        >
          Back
        </button>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSaving}
          className="rounded-xl bg-emerald-700 px-8 py-3 text-lg font-medium text-white disabled:opacity-60"
        >
          {isSaving ? 'Submitting...' : 'Submit Case'}
        </button>
      </div>

      {success && (
        <div className="mt-8 rounded-2xl bg-emerald-100 px-6 py-4 text-xl text-emerald-900">
          {success}
        </div>
      )}

      {error && (
        <div className="mt-8 rounded-2xl bg-red-100 px-6 py-4 text-xl text-red-900">
          {error}
        </div>
      )}
    </div>
  )
}
