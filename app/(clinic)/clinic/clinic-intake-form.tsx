'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import type { loadIntakeDraft } from '@/app/actions/intake/load-intake-draft'
import { saveCase } from '@/app/actions/save-case'

type ClinicOption = {
  id: string
  name: string
}

type ClinicIntakeData = Awaited<ReturnType<typeof loadIntakeDraft>>

export function ClinicIntakeForm({
  intake,
  clinicContext = null,
  fallbackClinics = [],
  allowDevClinicSelection = false,
  renderWithinPage = false,
}: {
  intake: ClinicIntakeData
  clinicContext?: ClinicOption | null
  fallbackClinics?: ClinicOption[]
  allowDevClinicSelection?: boolean
  renderWithinPage?: boolean
}) {
  const router = useRouter()

  console.log('INTAKE_PAYLOAD', intake)

  const catalog = intake?.catalog

  console.log('INTAKE_CATALOG', catalog)
  console.log('CATALOG_MEMORIAL_ITEMS', catalog?.memorialItems)
  console.log('CATALOG_PREMIUM_URNS', catalog?.premiumUrns)
  console.log('CATALOG_SOUL_BURSTS', catalog?.soulBursts)
  console.log('CATALOG_ADDONS', catalog?.addOns)
  console.log('INTAKE_PET', intake?.pet)
  console.log('INTAKE_OWNER', intake?.owner)

  const resolvedClinic =
    clinicContext ??
    (intake?.catalog?.clinic
      ? {
          id: intake.catalog.clinic.id,
          name: intake.catalog.clinic.name,
        }
      : null)

  const [clinicId, setClinicId] = useState(resolvedClinic?.id ?? '')
  const [petName, setPetName] = useState(() => intake?.pet?.petName ?? '')
  const [species, setSpecies] = useState(() => intake?.pet?.species ?? '')
  const [weight, setWeight] = useState(() => {
    if (intake?.pet?.weightLbs !== null && intake?.pet?.weightLbs !== undefined) {
      return String(intake.pet.weightLbs)
    }

    if (intake?.pet?.weightKg !== null && intake?.pet?.weightKg !== undefined) {
      return String(intake.pet.weightKg)
    }

    return ''
  })
  const [weightUnit, setWeightUnit] = useState<'lbs' | 'kg'>(() => {
    if (intake?.pet?.weightLbs !== null && intake?.pet?.weightLbs !== undefined) {
      return 'lbs'
    }

    if (intake?.pet?.weightKg !== null && intake?.pet?.weightKg !== undefined) {
      return 'kg'
    }

    return 'lbs'
  })
  const [breed, setBreed] = useState(() => intake?.pet?.breed ?? '')
  const [color, setColor] = useState(() => intake?.pet?.color ?? '')

  const [ownerFirstName, setOwnerFirstName] = useState(() => {
    const ownerName = intake?.owner?.ownerName?.trim() ?? ''

    if (!ownerName) {
      return ''
    }

    const [firstName = ''] = ownerName.split(/\s+/, 1)
    return firstName
  })
  const [ownerLastName, setOwnerLastName] = useState(() => {
    const ownerName = intake?.owner?.ownerName?.trim() ?? ''

    if (!ownerName) {
      return ''
    }

    const [, ...rest] = ownerName.split(/\s+/)
    return rest.join(' ')
  })
  const [phone, setPhone] = useState(() => intake?.owner?.phone ?? '')
  const [email, setEmail] = useState(() => intake?.owner?.email ?? '')
  const [street, setStreet] = useState(() => intake?.owner?.addressLine1 ?? '')
  const [city, setCity] = useState(() => intake?.owner?.city ?? '')
  const [state, setState] = useState(() => intake?.owner?.state ?? 'OR')
  const [zip, setZip] = useState(() => intake?.owner?.postalCode ?? '')
  const [cremationType, setCremationType] = useState<'private' | 'general' | ''>(() => {
    return intake?.service?.cremationType ?? ''
  })
  const [selectedMemorialItems, setSelectedMemorialItems] = useState<string[]>([])

  const [error, setError] = useState('')
  const memorialItems = intake.catalog?.memorialItems ?? []

  const selectedMemorialTotalCents = memorialItems
    .filter((item) => selectedMemorialItems.includes(item.productId))
    .reduce((sum, item) => sum + (item.priceCents ?? 0), 0)

  const formattedMemorialTotal = `$${(selectedMemorialTotalCents / 100).toFixed(2)}`

  const hasClinicContext = Boolean(resolvedClinic)
  const hasAnyClinics = hasClinicContext || fallbackClinics.length > 0
  const showDevClinicSelector = !hasClinicContext && allowDevClinicSelection && fallbackClinics.length > 1
  const selectedClinic =
    resolvedClinic ?? fallbackClinics.find((clinic) => clinic.id === clinicId) ?? null
  const continueDisabled = !selectedClinic && !showDevClinicSelector

  function formatPhone(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 10)

    if (digits.length <= 3) return digits
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`

    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }

  function toggleMemorialItem(productId: string) {
    setSelectedMemorialItems((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    )
  }

  async function handleContinue() {
    if (continueDisabled) {
      setError(
        hasAnyClinics
          ? 'No active clinic context exists for this intake session.'
          : 'No active clinics found. Add a clinic in Admin first.'
      )
      return
    }

    if (!clinicId || !petName || !species || !weight || !ownerFirstName || !ownerLastName) {
      setError('Please complete all required fields.')
      return
    }

    if (!selectedClinic) {
      setError(
        showDevClinicSelector
          ? 'Please select a valid clinic.'
          : 'No active clinic context exists for this intake session.'
      )
      return
    }

    const weightValue = parseFloat(weight) || 0
    const petWeightLbs = weightUnit === 'kg' ? Number((weightValue * 2.20462).toFixed(2)) : weightValue

    const caseData = {
      formNumber: 'HPC26-165',
      dateOpened: new Date().toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }),
      clinicId,
      clinicName: selectedClinic.name,
      petName,
      species,
      weight,
      weightUnit,
      petWeightLbs,
      breed,
      color,
      ownerFirstName,
      ownerLastName,
      phone,
      email,
      street,
      city,
      state,
      zip,
      cremationType: '',
    }

    const selectedMemorialProducts = memorialItems
      .filter((item) => selectedMemorialItems.includes(item.productId))
      .map((item) => ({
        product_id: item.productId,
        name: item.name,
        price_cents: item.priceCents ?? 0,
      }))

    try {
      const payload = {
        clinic_name: selectedClinic.name,
        pet_name: petName,
        pet_species: species,
        pet_weight: weight,
        pet_weight_unit: weightUnit,
        pet_weight_lbs: petWeightLbs,
        pet_breed: breed,
        pet_color: color,
        owner_name: `${ownerFirstName} ${ownerLastName}`.trim(),
        owner_phone: phone || undefined,
        owner_email: email || undefined,
        owner_address: street || undefined,
        owner_city: city || undefined,
        owner_state: state || undefined,
        owner_zip: zip || undefined,
        cremation_type: '',
        selected_memorial_items: selectedMemorialProducts,
        memorial_items_total_cents: selectedMemorialTotalCents,
        case_data: caseData,
      }

      const result = await saveCase(payload)
      setError('')
      router.push(`/cases/${result.id}`)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to save case.')
    }
  }

  const content = (
    <div className="mx-auto max-w-6xl rounded-[28px] bg-neutral-100">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
          Pet and Owner Information
        </h1>

        <p className="mt-3 text-xl text-slate-500">
          All required intake fields are captured before the case moves forward.
        </p>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold text-slate-900">
            Clinic and Pet Identification
          </h2>

          <div className="mt-6 grid gap-6 md:grid-cols-12">
            <div className="md:col-span-6">
              <label className="mb-3 block text-xl font-semibold">Clinic</label>
              {resolvedClinic ? (
                <div className="w-full rounded-[22px] border border-slate-200 bg-slate-50 px-6 py-5 text-2xl font-medium text-slate-900">
                  {resolvedClinic.name}
                </div>
              ) : showDevClinicSelector ? (
                <div className="space-y-3">
                  <p className="text-base text-amber-700">
                    Development fallback only. Final clinic-authenticated flow should provide clinic
                    context automatically.
                  </p>
                  <select
                    className="w-full rounded-[22px] border border-slate-200 px-6 py-5 text-2xl"
                    value={clinicId}
                    onChange={(e) => setClinicId(e.target.value)}
                  >
                    <option value="">Select Clinic</option>
                    {fallbackClinics.map((clinic) => (
                      <option key={clinic.id} value={clinic.id}>
                        {clinic.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="rounded-[22px] border border-amber-200 bg-amber-50 px-6 py-5 text-lg text-amber-900">
                  {hasAnyClinics
                    ? 'No active clinic context exists for this intake session.'
                    : 'No active clinics found. Add a clinic in Admin first.'}
                </div>
              )}
            </div>

            <div className="md:col-span-6">
              <label className="mb-3 block text-xl font-semibold">Pet Name</label>
              <input
                className="w-full rounded-[22px] border border-slate-200 px-6 py-5 text-2xl"
                value={petName}
                onChange={(e) => setPetName(e.target.value)}
              />
            </div>

            <div className="md:col-span-3">
              <label className="mb-3 block text-xl font-semibold">Species</label>
              <select
                className="w-full rounded-[22px] border border-slate-200 px-6 py-5 text-2xl"
                value={species}
                onChange={(e) => setSpecies(e.target.value)}
              >
                <option value="">Select Species</option>
                <option value="Dog">Dog</option>
                <option value="Cat">Cat</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="md:col-span-3">
              <label className="mb-3 block text-xl font-semibold">Weight</label>
              <div className="flex gap-3">
                <input
                  className="min-w-0 flex-1 rounded-[22px] border border-slate-200 px-6 py-5 text-2xl"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="0.0"
                />
                <select
                  className="w-[140px] rounded-[22px] border border-slate-200 px-5 py-5 text-2xl font-semibold"
                  value={weightUnit}
                  onChange={(e) => setWeightUnit(e.target.value as 'lbs' | 'kg')}
                >
                  <option value="lbs">lbs</option>
                  <option value="kg">kg</option>
                </select>
              </div>
            </div>

            <div className="md:col-span-6">
              <label className="mb-3 block text-xl font-semibold">Breed</label>
              <input
                className="w-full rounded-[22px] border border-slate-200 px-6 py-5 text-2xl"
                value={breed}
                onChange={(e) => setBreed(e.target.value)}
              />
            </div>

            <div className="md:col-span-6">
              <label className="mb-3 block text-xl font-semibold">Color</label>
              <input
                className="w-full rounded-[22px] border border-slate-200 px-6 py-5 text-2xl"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
            </div>
          </div>
        </section>

        <section className="mt-16">
          <h2 className="text-2xl font-semibold text-slate-900">
            Owner Information
          </h2>

          <div className="mt-6 grid gap-6 md:grid-cols-12">
            <div className="md:col-span-6">
              <label className="mb-3 block text-xl font-semibold">First Name</label>
              <input
                className="w-full rounded-[22px] border border-slate-200 px-6 py-5 text-2xl"
                value={ownerFirstName}
                onChange={(e) => setOwnerFirstName(e.target.value)}
              />
            </div>

            <div className="md:col-span-6">
              <label className="mb-3 block text-xl font-semibold">Last Name</label>
              <input
                className="w-full rounded-[22px] border border-slate-200 px-6 py-5 text-2xl"
                value={ownerLastName}
                onChange={(e) => setOwnerLastName(e.target.value)}
              />
            </div>

            <div className="md:col-span-6">
              <label className="mb-3 block text-xl font-semibold">Phone Number</label>
              <input
                className="w-full rounded-[22px] border border-slate-200 px-6 py-5 text-2xl"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
              />
            </div>

            <div className="md:col-span-6">
              <label className="mb-3 block text-xl font-semibold">Email</label>
              <input
                className="w-full rounded-[22px] border border-slate-200 px-6 py-5 text-2xl"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="md:col-span-12">
              <label className="mb-3 block text-xl font-semibold">Address / Street</label>
              <input
                className="w-full rounded-[22px] border border-slate-200 px-6 py-5 text-2xl"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
              />
            </div>

            <div className="md:col-span-6">
              <label className="mb-3 block text-xl font-semibold">City</label>
              <input
                className="w-full rounded-[22px] border border-slate-200 px-6 py-5 text-2xl"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>

            <div className="md:col-span-3">
              <label className="mb-3 block text-xl font-semibold">State</label>
              <select
                className="w-full rounded-[22px] border border-slate-200 px-6 py-5 text-2xl"
                value={state}
                onChange={(e) => setState(e.target.value)}
              >
                {[
                  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
                  'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
                  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
                  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
                  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
                ].map((abbreviation) => (
                  <option key={abbreviation} value={abbreviation}>{abbreviation}</option>
                ))}
              </select>
            </div>

            <div className="md:col-span-3">
              <label className="mb-3 block text-xl font-semibold">Zip Code</label>
              <input
                className="w-full rounded-[22px] border border-slate-200 px-6 py-5 text-2xl"
                value={zip}
                onChange={(e) => setZip(e.target.value)}
              />
            </div>
          </div>
        </section>

        <section className="mt-16">
          <h2 className="text-2xl font-semibold text-slate-900">
            Cremation Type
          </h2>

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <button
              type="button"
              onClick={() => setCremationType('private')}
              className={`rounded-[22px] border px-6 py-5 text-left ${
                cremationType === 'private'
                  ? 'border-emerald-600 bg-emerald-50'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <h3 className="text-xl font-semibold text-slate-900">Private Cremation</h3>
              <p className="mt-2 text-base text-slate-500">
                Your pet is cremated individually and ashes are returned.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setCremationType('general')}
              className={`rounded-[22px] border px-6 py-5 text-left ${
                cremationType === 'general'
                  ? 'border-emerald-600 bg-emerald-50'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <h3 className="text-xl font-semibold text-slate-900">General Cremation</h3>
              <p className="mt-2 text-base text-slate-500">
                Your pet is cremated with others and ashes are not returned.
              </p>
            </button>
          </div>
        </section>

        <section className="mt-16">
          <h2 className="text-2xl font-semibold text-slate-900">
            Memorial Items
          </h2>

          {!intake.catalog?.memorialItems?.length ? (
            <p className="mt-6 text-xl text-slate-500">
              No memorial items available
            </p>
          ) : (
            <div className="mt-6 grid gap-6 md:grid-cols-2">
              {intake.catalog.memorialItems.map((item) => (
                <div
                  key={item.productId}
                  onClick={() => toggleMemorialItem(item.productId)}
                  className={`cursor-pointer rounded-[22px] border px-6 py-5 ${
                    selectedMemorialItems.includes(item.productId)
                      ? 'border-emerald-600 bg-emerald-50'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="text-xl font-semibold text-slate-900">{item.name}</h3>
                    <p className="text-lg font-medium text-slate-700">
                      ${(item.priceCents / 100).toFixed(2)}
                    </p>
                  </div>

                  {item.description ? (
                    <p className="mt-3 text-base text-slate-500">{item.description}</p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-10">
          <div className="flex items-center justify-between rounded-[22px] bg-slate-900 px-6 py-5 text-white">
            <span className="text-xl font-semibold">Memorial Items Total</span>
            <span className="text-2xl font-bold">{formattedMemorialTotal}</span>
          </div>
        </section>

        {error && (
          <div className="mt-8 rounded-xl bg-red-100 p-5 text-xl text-red-700">
            {error}
          </div>
        )}

        <div className="mt-14 flex items-center justify-between border-t pt-10">
          <p className="text-xl text-slate-500">
            {continueDisabled
              ? 'Clinic context is required before moving to cremation wishes.'
              : 'Required before moving to cremation wishes.'}
          </p>

          <button
            onClick={handleContinue}
            disabled={continueDisabled}
            className="rounded-[22px] bg-emerald-900 px-10 py-5 text-2xl text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Continue
          </button>
        </div>
      </div>
  )

  if (renderWithinPage) {
    return content
  }

  return (
    <main className="min-h-screen bg-neutral-100 px-6 py-8 md:px-10">
      {content}
    </main>
  )
}
