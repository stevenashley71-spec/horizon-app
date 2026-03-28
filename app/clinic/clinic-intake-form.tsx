'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type ClinicOption = {
  id: string
  name: string
}

export function ClinicIntakeForm({
  clinicContext,
  fallbackClinics,
  allowDevClinicSelection,
  renderWithinPage = false,
}: {
  clinicContext: ClinicOption | null
  fallbackClinics: ClinicOption[]
  allowDevClinicSelection: boolean
  renderWithinPage?: boolean
}) {
  const router = useRouter()

  const [clinicId, setClinicId] = useState(clinicContext?.id ?? '')
  const [petName, setPetName] = useState('')
  const [species, setSpecies] = useState('')
  const [weight, setWeight] = useState('')
  const [weightUnit, setWeightUnit] = useState<'lbs' | 'kg'>('lbs')
  const [breed, setBreed] = useState('')
  const [color, setColor] = useState('')

  const [ownerFirstName, setOwnerFirstName] = useState('')
  const [ownerLastName, setOwnerLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [street, setStreet] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('OR')
  const [zip, setZip] = useState('')

  const [error, setError] = useState('')

  const hasClinicContext = Boolean(clinicContext)
  const hasAnyClinics = hasClinicContext || fallbackClinics.length > 0
  const showDevClinicSelector = !hasClinicContext && allowDevClinicSelection && fallbackClinics.length > 1
  const selectedClinic =
    clinicContext ?? fallbackClinics.find((clinic) => clinic.id === clinicId) ?? null
  const continueDisabled = !selectedClinic && !showDevClinicSelector

  function formatPhone(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 10)

    if (digits.length <= 3) return digits
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`

    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }

  function handleContinue() {
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

    localStorage.setItem('horizonCase', JSON.stringify(caseData))
    setError('')
    router.push('/cremation')
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
              {clinicContext ? (
                <div className="w-full rounded-[22px] border border-slate-200 bg-slate-50 px-6 py-5 text-2xl font-medium text-slate-900">
                  {clinicContext.name}
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
