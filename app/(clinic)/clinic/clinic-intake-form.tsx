'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { validateClinicPinInternal } from '@/app/actions/validate-clinic-pin-internal'
import type { loadIntakeDraft } from '@/app/actions/intake/load-intake-draft'
import { saveCase } from '@/app/actions/save-case'
import { validateClinicExitPin } from '@/app/actions/validate-clinic-exit-pin'

type ClinicOption = {
  id: string
  name: string
}

type ClinicIntakeData = Awaited<ReturnType<typeof loadIntakeDraft>>

const PRIVATE_CREMATION_IMAGE = '/images/cremation/private-standard-urn.jpg'
const GENERAL_CREMATION_IMAGE = '/images/cremation/general-ranch.jpg'

export function ClinicIntakeForm({
  intake,
  clinicContext = null,
  fallbackClinics = [],
  allowDevClinicSelection = false,
  renderWithinPage = false,
  intakeType,
  isDirectKioskFlow = false,
  kioskInitialWeight,
  kioskInitialWeightUnit,
  onExitToStart,
  onSubmitSuccess,
  pendingExitTarget,
}: {
  intake: ClinicIntakeData
  clinicContext?: ClinicOption | null
  fallbackClinics?: ClinicOption[]
  allowDevClinicSelection?: boolean
  renderWithinPage?: boolean
  intakeType?: 'standard' | 'employee' | 'good_samaritan' | 'donation'
  isDirectKioskFlow?: boolean
  kioskInitialWeight?: string
  kioskInitialWeightUnit?: 'lbs' | 'kg'
  onExitToStart?: () => void
  onSubmitSuccess?: (result: { id: string; caseNumber?: string }) => void
  pendingExitTarget?: 'dashboard' | 'cases' | 'logout'
}) {
  const router = useRouter()

  console.log('INTAKE_PAYLOAD', intake)

  const catalog = intake?.catalog
  const resolvedPricing = catalog?.pricing
  const resolvedProductPricingById = new Map(
    (resolvedPricing?.productPricing ?? []).map((pricingRow) => [pricingRow.productId, pricingRow])
  )

  console.log('INTAKE_CATALOG', catalog)
  console.log('INTAKE_RESOLVED_PRICING', resolvedPricing)
  console.log('INTAKE_RESOLVED_PRODUCT_PRICING', resolvedPricing?.productPricing)
  console.log('INTAKE_RESOLVED_CREMATION_PRICING', resolvedPricing?.cremationPricing)
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
  const normalizedIntakeType = intakeType ?? 'standard'
  const isEmployeeIntake = normalizedIntakeType === 'employee'
  const isGoodSamaritanIntake = normalizedIntakeType === 'good_samaritan'
  const isSpecialMemorialInclusionIntake =
    normalizedIntakeType === 'employee' || normalizedIntakeType === 'donation'

  const [clinicId, setClinicId] = useState(resolvedClinic?.id ?? '')
  const [petName, setPetName] = useState(() => intake?.pet?.petName ?? '')
  const [species, setSpecies] = useState(() => intake?.pet?.species ?? '')
  const [weight, setWeight] = useState(() => {
    if (kioskInitialWeight !== undefined) {
      return kioskInitialWeight
    }

    if (intake?.pet?.weightLbs !== null && intake?.pet?.weightLbs !== undefined) {
      return String(intake.pet.weightLbs)
    }

    if (intake?.pet?.weightKg !== null && intake?.pet?.weightKg !== undefined) {
      return String(intake.pet.weightKg)
    }

    return ''
  })
  const [weightUnit, setWeightUnit] = useState<'lbs' | 'kg'>(() => {
    if (kioskInitialWeight !== undefined) {
      return kioskInitialWeightUnit ?? 'lbs'
    }

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
  const [understandsCremationDifference, setUnderstandsCremationDifference] = useState(false)
  const [confirmsPrivateReturn, setConfirmsPrivateReturn] = useState(false)
  const [confirmsGeneralNoReturn, setConfirmsGeneralNoReturn] = useState(false)
  const [selectedMemorialItems, setSelectedMemorialItems] = useState<Record<string, number>>({})
  const [selectedUrn, setSelectedUrn] = useState<string | null>(null)
  const [selectedSoulBursts, setSelectedSoulBursts] = useState<string[]>([])
  const [signatureName, setSignatureName] = useState('')
  const [isAcknowledged, setIsAcknowledged] = useState(false)
  const [isWeightUnlocked, setIsWeightUnlocked] = useState(false)
  const [isWeightPinPromptOpen, setIsWeightPinPromptOpen] = useState(false)
  const [weightPinInput, setWeightPinInput] = useState('')
  const [weightPinError, setWeightPinError] = useState('')
  const [isPinPromptOpen, setIsPinPromptOpen] = useState(false)
  const [enteredPin, setEnteredPin] = useState('')
  const [currentStep, setCurrentStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [error, setError] = useState('')
  const memorialItems = intake.catalog?.memorialItems ?? []
  const memorialItemsByProductId = new Map(memorialItems.map((item) => [item.productId, item]))
  const isKioskWeightLocked = kioskInitialWeight !== undefined
  const isWeightLocked = !isWeightUnlocked
  const numericWeight = Number(weight)
  const weightInLbs =
    weightUnit === 'kg'
      ? Number((numericWeight * 2.20462).toFixed(2))
      : numericWeight

  useEffect(() => {
    if (!pendingExitTarget) {
      return
    }

    setError('')
    setEnteredPin('')
    setIsPinPromptOpen(true)
  }, [pendingExitTarget])

  useEffect(() => {
    if (!isGoodSamaritanIntake) {
      return
    }

    if (cremationType === 'private') {
      setCremationType('')
      setUnderstandsCremationDifference(false)
      setConfirmsPrivateReturn(false)
      setConfirmsGeneralNoReturn(false)
    }

    setSelectedMemorialItems((prev) => {
      if (Object.keys(prev).length === 0) {
        return prev
      }

      return {}
    })

    setSelectedUrn((prev) => {
      if (prev === null) {
        return prev
      }

      return null
    })

    setSelectedSoulBursts((prev) => {
      if (prev.length === 0) {
        return prev
      }

      return []
    })
  }, [isGoodSamaritanIntake, cremationType])

  function isIncludedMemorialItem(item: (typeof memorialItems)[number]) {
    return item.includedInCremation === true
  }

  function getMemorialItem(productId: string) {
    return memorialItemsByProductId.get(productId)
  }

  function getResolvedProductPriceCents(productId: string, fallbackPriceCents: number) {
    const resolvedRow = resolvedProductPricingById.get(productId)
    return resolvedRow?.clientVisiblePriceCents ?? fallbackPriceCents
  }

  function getMemorialClientPriceCents(item: (typeof memorialItems)[number]) {
    if (isIncludedMemorialItem(item)) {
      return 0
    }

    return getResolvedProductPriceCents(item.productId, item.priceCents ?? 0)
  }

  function isEmployeeIncludedMemorial(item: (typeof memorialItems)[number]) {
    return isSpecialMemorialInclusionIntake && item?.metadata?.includedInEmployeePet === true
  }

  function getEffectiveMemorialQuantity(item: (typeof memorialItems)[number]) {
    if (isIncludedMemorialItem(item)) {
      return 1
    }

    return selectedMemorialItems[item.productId] || 0
  }

  function getChargeableMemorialQuantity(item: (typeof memorialItems)[number]) {
    const effectiveQuantity = getEffectiveMemorialQuantity(item)

    if (effectiveQuantity <= 0) {
      return 0
    }

    if (isEmployeeIncludedMemorial(item)) {
      return Math.max(effectiveQuantity - 1, 0)
    }

    return effectiveQuantity
  }

  const effectiveSelectedMemorialItems = memorialItems.reduce<Record<string, number>>((acc, item) => {
    const qty = getEffectiveMemorialQuantity(item)

    if (qty > 0) {
      acc[item.productId] = qty
    }

    return acc
  }, {})

  function getCurrentPetWeightLbs() {
    const numericWeight = Number(weight)

    if (!Number.isFinite(numericWeight) || numericWeight <= 0) {
      return null
    }

    return weightUnit === 'kg' ? Number((numericWeight * 2.20462).toFixed(2)) : numericWeight
  }

  function getResolvedCremationPricingRow(type: 'private' | 'general') {
    const currentPetWeightLbs = getCurrentPetWeightLbs()
    const cremationRows = resolvedPricing?.cremationPricing ?? []

    const eligibleRows = cremationRows.filter((row) => {
      if (!row.active || row.cremationType !== type) {
        return false
      }

      const hasBounds = row.weightMinLbs !== null || row.weightMaxLbs !== null

      if (!hasBounds) {
        return true
      }

      if (currentPetWeightLbs === null) {
        return false
      }

      const meetsMin = row.weightMinLbs === null || currentPetWeightLbs >= row.weightMinLbs
      const meetsMax = row.weightMaxLbs === null || currentPetWeightLbs <= row.weightMaxLbs

      return meetsMin && meetsMax
    })

    const getRowIntakeType = (row: (typeof cremationRows)[number]) => {
      return typeof row.metadata?.intakeType === 'string' ? row.metadata.intakeType : 'standard'
    }

    const matchingRows =
      eligibleRows.filter((row) => getRowIntakeType(row) === normalizedIntakeType)

    const fallbackRows =
      matchingRows.length > 0
        ? matchingRows
        : eligibleRows.filter((row) => getRowIntakeType(row) === 'standard')

    const boundedMatch =
      fallbackRows.find((row) => row.weightMinLbs !== null || row.weightMaxLbs !== null) ?? null
    const genericMatch =
      fallbackRows.find((row) => row.weightMinLbs === null && row.weightMaxLbs === null) ?? null

    return boundedMatch ?? genericMatch
  }

  function getResolvedCremationPriceCents(
    type: 'private' | 'general',
    fallbackPriceCents: number | null = null
  ) {
    const resolvedRow = getResolvedCremationPricingRow(type)
    return resolvedRow?.clientVisiblePriceCents ?? fallbackPriceCents
  }

  const resolvedPrivateCremationPriceCents = getResolvedCremationPriceCents('private', null)
  const resolvedGeneralCremationPriceCents = getResolvedCremationPriceCents('general', null)
  const selectedCremationPricingRow = cremationType
    ? getResolvedCremationPricingRow(cremationType)
    : null
  const isGoodSamaritanOrDonationIntake =
    normalizedIntakeType === 'good_samaritan' || normalizedIntakeType === 'donation'
  const isUsingFallbackCremationPricing =
    isGoodSamaritanOrDonationIntake &&
    Boolean(cremationType) &&
    selectedCremationPricingRow !== null &&
    selectedCremationPricingRow.metadata?.intakeType !== normalizedIntakeType

  console.log('INTAKE_RESOLVED_PRIVATE_CREMATION_PRICE_CENTS', resolvedPrivateCremationPriceCents)
  console.log('INTAKE_RESOLVED_GENERAL_CREMATION_PRICE_CENTS', resolvedGeneralCremationPriceCents)

  const selectedMemorialTotalCents = memorialItems.reduce((sum, item) => {
    const qty = getChargeableMemorialQuantity(item)
    return sum + qty * getMemorialClientPriceCents(item)
  }, 0)

  const formattedMemorialTotal = `$${(selectedMemorialTotalCents / 100).toFixed(2)}`

  const hasClinicContext = Boolean(resolvedClinic)
  const hasAnyClinics = hasClinicContext || fallbackClinics.length > 0
  const showDevClinicSelector = !hasClinicContext && allowDevClinicSelection && fallbackClinics.length > 1
  const selectedClinic =
    resolvedClinic ?? fallbackClinics.find((clinic) => clinic.id === clinicId) ?? null
  const continueDisabled = !selectedClinic && !showDevClinicSelector
  const canAttemptWeightUnlock = Boolean(selectedClinic?.id)

  function isStep1Valid() {
    return Boolean(
      selectedClinic &&
      petName.trim() &&
      species &&
      weight &&
      ownerFirstName.trim() &&
      ownerLastName.trim()
    )
  }

  function formatPhone(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 10)

    if (digits.length <= 3) return digits
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`

    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }

  function incrementMemorialItem(productId: string) {
    if (isGoodSamaritanIntake) {
      return
    }

    const item = getMemorialItem(productId)

    if (item && isIncludedMemorialItem(item)) {
      return
    }

    setSelectedMemorialItems((prev) => ({
      ...prev,
      [productId]: (prev[productId] || 0) + 1,
    }))
  }

  function decrementMemorialItem(productId: string) {
    if (isGoodSamaritanIntake) {
      return
    }

    const item = getMemorialItem(productId)

    if (item && isIncludedMemorialItem(item)) {
      return
    }

    setSelectedMemorialItems((prev) => {
      const current = prev[productId] || 0
      if (current <= 1) {
        const copy = { ...prev }
        delete copy[productId]
        return copy
      }
      return {
        ...prev,
        [productId]: current - 1,
      }
    })
  }

  function toggleUrn(productId: string) {
    void productId
  }

  function toggleSoulBurst(productId: string) {
    void productId
  }

  function handleCremationTypeSelect(value: 'private' | 'general') {
    if (isGoodSamaritanIntake && value === 'private') {
      return
    }

    setCremationType(value)
    setError('')

    // Reset ALL acknowledgments when selection changes
    setUnderstandsCremationDifference(false)
    setConfirmsPrivateReturn(false)
    setConfirmsGeneralNoReturn(false)
  }

  function handleProtectedExit() {
    setError('')
    setEnteredPin('')
    setIsPinPromptOpen(true)
  }

  function handleCancelExit() {
    setEnteredPin('')
    setIsPinPromptOpen(false)

    if (pendingExitTarget) {
      router.push('/clinic/new')
    }
  }

  async function handleConfirmExit() {
    const isValid = await validateClinicExitPin(enteredPin)

    if (isValid) {
      setError('')
      setEnteredPin('')
      setIsPinPromptOpen(false)

      if (pendingExitTarget === 'cases') {
        router.push('/cases')
        return
      }

      if (pendingExitTarget === 'logout') {
        router.push('/clinic/login')
        return
      }

      if (pendingExitTarget === 'dashboard') {
        router.push('/clinic')
        return
      }

      onExitToStart?.()
      return
    }

    setError('Incorrect PIN')
  }

  function handleOpenWeightPinPrompt() {
    if (!canAttemptWeightUnlock) {
      return
    }

    setWeightPinInput('')
    setWeightPinError('')
    setIsWeightPinPromptOpen(true)
  }

  function handleCancelWeightPinPrompt() {
    setWeightPinInput('')
    setWeightPinError('')
    setIsWeightPinPromptOpen(false)
  }

  async function handleConfirmWeightUnlock() {
    if (!selectedClinic?.id) {
      setWeightPinError('Incorrect PIN')
      return
    }

    const isDirectKiosk = isDirectKioskFlow === true

    const isValid = isDirectKiosk
      ? await validateClinicPinInternal(selectedClinic.id, weightPinInput)
      : await validateClinicExitPin(weightPinInput)

    if (isValid) {
      setIsWeightUnlocked(true)
      setIsWeightPinPromptOpen(false)
      setWeightPinInput('')
      setWeightPinError('')
      return
    }

    setWeightPinError('Incorrect PIN')
  }

  function handleStepContinue() {
    if (currentStep === 2) {
      if (isGoodSamaritanIntake && cremationType !== 'general') {
        setError('Good Samaritan intakes must use General cremation.')
        return
      }

      if (!cremationType) {
        setError('Please select a cremation type before continuing.')
        return
      }

      if (!understandsCremationDifference) {
        setError('Please confirm that you understand the difference between cremation options.')
        return
      }

      if (cremationType === 'private' && !confirmsPrivateReturn) {
        setError("Please confirm that you want your pet's cremated remains returned.")
        return
      }

      if (cremationType === 'general' && !confirmsGeneralNoReturn) {
        setError('Please confirm that you understand cremated remains will not be returned.')
        return
      }

      const resolvedCremationPricingRow = selectedCremationPricingRow
      const resolvedCremationPriceCents = resolvedCremationPricingRow?.clientVisiblePriceCents ?? null

      if (!resolvedCremationPricingRow || resolvedCremationPriceCents === null) {
        setError('Cremation pricing is not configured for this clinic. Please contact Horizon.')
        return
      }

      if (isUsingFallbackCremationPricing) {
        setError('Pricing for this intake type is not configured. Please contact Horizon.')
        return
      }
    }

    setError('')
    setCurrentStep((step) => {
      if (step === 3 && isGoodSamaritanIntake) {
        return 5
      }

      if (step === 3 && cremationType === 'general') {
        return 5
      }
      return Math.min(step + 1, 6)
    })
  }

  function handleStepBack() {
    setError('')
    setCurrentStep((step) => {
      if (step === 5 && isGoodSamaritanIntake) {
        return 2
      }

      if (step === 5 && cremationType === 'general') {
        return 3
      }
      return Math.max(step - 1, 1)
    })
  }

  async function handleSubmit() {
    if (isSubmitting) {
      return
    }

    if (!isStep1Valid()) {
      setError('Please complete all required intake fields before submitting.')
      return
    }

    if (!isAcknowledged) {
      setError('You must confirm authorization before submitting.')
      return
    }

    if (!signatureName.trim()) {
      setError('Signature name is required.')
      return
    }

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
      intake_type: normalizedIntakeType,
      cremationType: cremationType || null,
    }

    const selectedMemorialProducts = isGoodSamaritanIntake
      ? []
      : memorialItems.flatMap((item) => {
          const qty = getEffectiveMemorialQuantity(item)

          if (qty <= 0) {
            return []
          }

          return Array.from({ length: qty }).map((_, index) => ({
            product_id: item.productId,
            name: item.name,
            price_cents:
              isEmployeeIncludedMemorial(item) && index === 0
                ? 0
                : getMemorialClientPriceCents(item),
          }))
        })

    setIsSubmitting(true)

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
        cremation_type: cremationType || null,
        selected_memorial_items: selectedMemorialProducts,
        memorial_items_total_cents: isGoodSamaritanIntake ? 0 : selectedMemorialTotalCents,
        case_data: caseData,
      }

      const result = await saveCase(payload)
      const createdCaseId =
        result && typeof result.id === 'string' ? result.id.trim() : ''

      if (!createdCaseId) {
        throw new Error('Case was created without a valid id.')
      }

      setError('')
      if (onSubmitSuccess) {
        onSubmitSuccess({
          id: createdCaseId,
          caseNumber:
            result && typeof result.caseNumber === 'string' ? result.caseNumber : undefined,
        })
      } else {
        router.push(`/clinic/submitted/${createdCaseId}`)
      }
    } catch (submitError) {
      setIsSubmitting(false)
      setError(submitError instanceof Error ? submitError.message : 'Failed to save case.')
    }
  }

  const stepTitle =
    currentStep === 1
      ? 'Pet & Owner'
      : currentStep === 2
        ? 'Cremation'
        : currentStep === 3
          ? 'Memorials'
          : currentStep === 4
            ? 'Urns & SoulBursts'
            : currentStep === 5
              ? 'Review'
              : 'Sign'

  const content = (
    <div className="mx-auto max-w-6xl rounded-[28px] bg-neutral-100">
      {onExitToStart ? (
        <div className="mb-6 flex justify-end">
          <button
            type="button"
            onClick={handleProtectedExit}
            className="rounded-[18px] bg-slate-200 px-6 py-3 text-lg font-medium text-slate-900 transition-colors hover:bg-slate-300"
          >
            Exit Intake
          </button>
        </div>
      ) : null}

      {isPinPromptOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-6 py-8">
          <div className="w-full max-w-md rounded-[28px] bg-white p-8 shadow-2xl">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">Exit Intake</h2>
            <p className="mt-3 text-base text-slate-500">
              Enter the clinic PIN to leave the intake and return to the start screen.
            </p>

            <div className="mt-6">
              <label className="mb-3 block text-xl font-semibold text-slate-900">PIN</label>
              <input
                type="password"
                value={enteredPin}
                onChange={(e) => setEnteredPin(e.target.value)}
                className="w-full rounded-[22px] border border-slate-200 px-6 py-5 text-2xl"
                placeholder="Enter PIN"
              />
            </div>

            <div className="mt-6 flex items-center justify-end gap-4">
              <button
                type="button"
                onClick={handleCancelExit}
                className="rounded-[18px] bg-slate-200 px-6 py-3 text-lg font-medium text-slate-900 transition-colors hover:bg-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmExit}
                className="rounded-[18px] bg-emerald-900 px-6 py-3 text-lg font-medium text-white transition-colors hover:bg-emerald-800"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isWeightPinPromptOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-6 py-8">
          <div className="w-full max-w-md rounded-[28px] bg-white p-8 shadow-2xl">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">Unlock Weight</h2>
            <p className="mt-3 text-base text-slate-500">
              Enter this clinic&apos;s PIN to edit the pet weight.
            </p>

            <div className="mt-6">
              <label className="mb-3 block text-xl font-semibold text-slate-900">PIN</label>
              <input
                type="password"
                value={weightPinInput}
                onChange={(e) => {
                  setWeightPinInput(e.target.value)
                  setWeightPinError('')
                }}
                className="w-full rounded-[22px] border border-slate-200 px-6 py-5 text-2xl"
                placeholder="Enter PIN"
              />
            </div>

            {weightPinError ? (
              <div className="mt-4 rounded-xl bg-red-100 p-4 text-base text-red-700">
                {weightPinError}
              </div>
            ) : null}

            <div className="mt-6 flex items-center justify-end gap-4">
              <button
                type="button"
                onClick={handleCancelWeightPinPrompt}
                className="rounded-[18px] bg-slate-200 px-6 py-3 text-lg font-medium text-slate-900 transition-colors hover:bg-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmWeightUnlock}
                className="rounded-[18px] bg-emerald-900 px-6 py-3 text-lg font-medium text-white transition-colors hover:bg-emerald-800"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="rounded-[28px] bg-white p-8 shadow-sm">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
          {stepTitle}
        </h1>

        <p className="mt-3 text-xl text-slate-500">
          Step {currentStep} of 6
        </p>
      </div>

      {currentStep === 1 ? (
        <div className="mt-8 rounded-[28px] bg-white p-8 shadow-sm">
          <section>
            <h2 className="text-2xl font-semibold text-slate-900">
              Clinic and Pet Identification
            </h2>

            {normalizedIntakeType !== 'standard' ? (
              <div className="mt-4">
                <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
                  {normalizedIntakeType === 'employee'
                    ? 'Employee Pet'
                    : normalizedIntakeType === 'good_samaritan'
                      ? 'Good Samaritan'
                      : 'Donation'}
                </span>
              </div>
            ) : null}

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
                {isWeightLocked ? (
                  <div className="space-y-3">
                    <div className="w-full rounded-[22px] border border-slate-200 bg-slate-50 px-6 py-5 text-2xl font-medium text-slate-900">
                      {Number.isFinite(weightInLbs) && weightInLbs > 0 ? `${weightInLbs} lbs` : '—'}
                    </div>
                    <button
                      type="button"
                      onClick={handleOpenWeightPinPrompt}
                      disabled={!canAttemptWeightUnlock}
                      className="rounded-[18px] bg-slate-200 px-5 py-3 text-base font-medium text-slate-900 transition-colors hover:bg-slate-300 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      Edit Weight
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <input
                      className="min-w-0 flex-1 rounded-[22px] border border-slate-200 px-6 py-5 text-2xl"
                      value={weight}
                      onChange={(e) => {
                        const raw = e.target.value
                        const sanitized = raw.replace(/[^0-9.]/g, '')
                        const parts = sanitized.split('.')
                        const normalized =
                          parts.length > 2
                            ? `${parts[0]}.${parts.slice(1).join('')}`
                            : sanitized

                        setWeight(normalized)
                      }}
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
                )}
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
        </div>
      ) : null}

      {currentStep === 2 ? (
        <div className="mt-8 rounded-[28px] bg-white p-8 shadow-sm">
          <section>
            <h2 className="text-2xl font-semibold text-slate-900">Cremation Type</h2>

            <div className="mt-6 grid gap-6 md:grid-cols-2">
	              <button
	                type="button"
	                onClick={() => handleCremationTypeSelect('private')}
	                disabled={isGoodSamaritanIntake}
	                className={`flex h-full flex-col rounded-[22px] border px-6 py-5 text-left ${
	                  cremationType === 'private'
	                    ? 'border-emerald-600 bg-emerald-50'
	                    : 'border-slate-200 bg-white'
	                } ${isGoodSamaritanIntake ? 'cursor-not-allowed opacity-50' : ''}`}
	              >
	                <div className="aspect-[4/3] overflow-hidden rounded-xl bg-slate-100">
	                  <img
	                    src={PRIVATE_CREMATION_IMAGE}
	                    alt="Private cremation standard included urn"
	                    className="h-full w-full object-cover"
	                  />
	                </div>
	                <h3 className="mt-4 text-2xl font-bold text-slate-900">Private Cremation</h3>
	                {resolvedPrivateCremationPriceCents !== null &&
	                resolvedPrivateCremationPriceCents !== undefined ? (
	                  <p className="mt-3 text-lg font-semibold text-slate-900">
	                    ${(resolvedPrivateCremationPriceCents / 100).toFixed(2)}
	                  </p>
	                ) : null}
	                <p className="mt-4 text-base text-slate-500">
	                  Your pet is cremated individually and ashes are returned.
	                </p>
	                {isGoodSamaritanIntake ? (
	                  <p className="mt-3 text-sm font-medium text-amber-800">
	                    Private cremation is not available for Good Samaritan intakes.
	                  </p>
	                ) : null}
	              </button>

	              <button
	                type="button"
	                onClick={() => handleCremationTypeSelect('general')}
	                className={`flex h-full flex-col rounded-[22px] border px-6 py-5 text-left ${
	                  cremationType === 'general'
	                    ? 'border-emerald-600 bg-emerald-50'
	                    : 'border-slate-200 bg-white'
	                }`}
	              >
	                <div className="aspect-[4/3] overflow-hidden rounded-xl bg-slate-100">
	                  <img
	                    src={GENERAL_CREMATION_IMAGE}
	                    alt="General cremation ranch memorial setting"
	                    className="h-full w-full object-cover"
	                  />
	                </div>
	                <h3 className="mt-4 text-2xl font-bold text-slate-900">General Cremation</h3>
	                {resolvedGeneralCremationPriceCents !== null &&
	                resolvedGeneralCremationPriceCents !== undefined ? (
	                  <p className="mt-3 text-lg font-semibold text-slate-900">
	                    ${(resolvedGeneralCremationPriceCents / 100).toFixed(2)}
	                  </p>
	                ) : null}
	                <p className="mt-4 text-base text-slate-500">
	                  Your pet is cremated with others and ashes are not returned.
	                </p>
	              </button>
            </div>

            <div className="mt-8 space-y-4">
              {isGoodSamaritanIntake ? (
                <div className="rounded-xl bg-slate-100 p-5 text-base text-slate-700">
                  Good Samaritan intakes are General cremation only.
                </div>
              ) : null}

              {isUsingFallbackCremationPricing ? (
                <div className="rounded-xl bg-amber-100 p-5 text-base text-amber-900">
                  Pricing for this intake type is not configured. Please contact Horizon.
                </div>
              ) : null}

              <label className="flex items-start gap-4 rounded-[22px] border border-slate-200 p-6">
                <input
                  type="checkbox"
                  checked={understandsCremationDifference}
                  onChange={(e) => setUnderstandsCremationDifference(e.target.checked)}
                  className="mt-1 h-6 w-6 rounded border-slate-300"
                />
                <span className="text-xl font-medium text-slate-900">
                  I understand that Private Cremation returns my pet&apos;s cremated remains, and
                  General Cremation does not.
                </span>
              </label>

              {cremationType === 'private' ? (
                <label className="flex items-start gap-4 rounded-[22px] border border-slate-200 p-6">
                  <input
                    type="checkbox"
                    checked={confirmsPrivateReturn}
                    onChange={(e) => setConfirmsPrivateReturn(e.target.checked)}
                    className="mt-1 h-6 w-6 rounded border-slate-300"
                  />
                  <span className="text-xl font-medium text-slate-900">
                    I confirm I want my pet&apos;s cremated remains returned to me.
                  </span>
                </label>
              ) : null}

              {cremationType === 'general' ? (
                <label className="flex items-start gap-4 rounded-[22px] border border-slate-200 p-6">
                  <input
                    type="checkbox"
                    checked={confirmsGeneralNoReturn}
                    onChange={(e) => setConfirmsGeneralNoReturn(e.target.checked)}
                    className="mt-1 h-6 w-6 rounded border-slate-300"
                  />
                  <span className="text-xl font-medium text-slate-900">
                    I confirm I understand that cremated remains will not be returned.
                  </span>
                </label>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}

      {currentStep === 3 ? (
        <div className="mt-8 rounded-[28px] bg-white p-8 shadow-sm">
          <section>
            <h2 className="text-2xl font-semibold text-slate-900">Memorials</h2>

            {isGoodSamaritanIntake ? (
              <div className="mt-6 rounded-[22px] border border-slate-200 bg-slate-50 px-6 py-5 text-lg text-slate-700">
                Memorial items are not available for Good Samaritan intakes.
              </div>
            ) : !intake.catalog?.memorialItems?.length ? (
              <p className="mt-6 text-xl text-slate-500">
                No memorial items available.
              </p>
            ) : (
              <div className="mt-6 grid gap-6 md:grid-cols-2">
                {memorialItems.map((item) => (
                  <button
                    key={item.productId}
                    type="button"
                    onClick={() => incrementMemorialItem(item.productId)}
                    disabled={isIncludedMemorialItem(item)}
                    className={`rounded-[22px] border px-6 py-5 text-left ${
                      isIncludedMemorialItem(item)
                        ? 'border-amber-300 bg-amber-50'
                        : getEffectiveMemorialQuantity(item) > 0
                        ? 'border-emerald-600 bg-emerald-50'
                        : 'border-slate-200 bg-white'
                    } ${isIncludedMemorialItem(item) ? 'cursor-default' : ''}`}
                  >
                    <div className="flex h-full flex-col">
                      {item.imageUrl ? (
                        <div className="aspect-[4/5] overflow-hidden rounded-xl bg-slate-100">
                          <img
                            src={item.imageUrl}
                            alt={item.imageAlt || item.name}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ) : null}

                      <div className={item.imageUrl ? 'mt-5' : ''}>
                        <div className="flex items-start justify-between gap-4">
                          <h3 className="text-xl font-semibold text-slate-900">{item.name}</h3>

                          {isIncludedMemorialItem(item) ? (
                            <span className="rounded-full bg-amber-600 px-3 py-1 text-sm font-semibold text-white">
                              Included with cremation
                            </span>
                          ) : null}
                        </div>

                        {item.description ? (
                          <p className="mt-3 text-base text-slate-500">{item.description}</p>
                        ) : null}

                        <p className="mt-5 text-2xl font-bold text-slate-900">
                          ${(getMemorialClientPriceCents(item) / 100).toFixed(2)}
                        </p>

                        {isIncludedMemorialItem(item) ? (
                          <p className="mt-2 text-sm font-medium text-amber-800">
                            Included with cremation
                          </p>
                        ) : null}

                        {!isIncludedMemorialItem(item) && getEffectiveMemorialQuantity(item) > 0 && (
                          <div className="mt-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  decrementMemorialItem(item.productId)
                                }}
                                className="h-10 w-10 rounded-full bg-slate-200 text-xl font-bold"
                              >
                                -
                              </button>

                              <span className="text-lg font-semibold">
                                {getEffectiveMemorialQuantity(item)}
                              </span>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  incrementMemorialItem(item.productId)
                                }}
                                className="h-10 w-10 rounded-full bg-emerald-700 text-xl font-bold text-white"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div className="mt-10 flex items-center justify-between rounded-[22px] bg-slate-900 px-6 py-5 text-white">
              <span className="text-xl font-semibold">Selected Memorial Total</span>
              <span className="text-2xl font-bold">{formattedMemorialTotal}</span>
            </div>
          </section>
        </div>
      ) : null}

      {cremationType === 'private' && currentStep === 4 ? (
        <div className="mt-8 rounded-[28px] bg-white p-8 shadow-sm">
          <section className="space-y-10">
            <div className="rounded-xl bg-slate-100 p-5 text-base text-slate-700">
              Premium urns and partner memorial items are not part of this work order and are handled separately.
            </div>

            {cremationType === 'private' ? (
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">Premium Urns</h2>

                {!intake.catalog?.premiumUrns?.length ? (
                  <p className="mt-6 text-xl text-slate-500">
                    No premium urns available.
                  </p>
                ) : (
                  <div className="mt-6 grid gap-6 md:grid-cols-2">
                    {intake.catalog.premiumUrns.map((item) => (
                      <button
                        key={item.productId}
                        type="button"
                        onClick={() => toggleUrn(item.productId)}
                        disabled
                        className="cursor-not-allowed rounded-[22px] border border-slate-200 bg-white px-6 py-5 text-left opacity-75"
                      >
                        <div className="flex h-full flex-col">
                          {item.imageUrl ? (
                            <div className="aspect-[4/5] overflow-hidden rounded-xl bg-slate-100">
                              <img
                                src={item.imageUrl}
                                alt={item.imageAlt || item.name}
                                className="h-full w-full object-cover"
                              />
                            </div>
                          ) : null}

                          <div className={item.imageUrl ? 'mt-5' : ''}>
                            <h3 className="text-xl font-semibold text-slate-900">{item.name}</h3>

                            {item.description ? (
                              <p className="mt-3 text-base text-slate-500">{item.description}</p>
                            ) : null}

          <p className="mt-5 text-2xl font-bold text-slate-900">
            ${(
              getResolvedProductPriceCents(item.productId, item.priceCents ?? 0) / 100
            ).toFixed(2)}
          </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            <div>
              <h2 className="text-2xl font-semibold text-slate-900">SoulBursts</h2>

              {!intake.catalog?.soulBursts?.length ? (
                <p className="mt-6 text-xl text-slate-500">
                  No SoulBursts available.
                </p>
              ) : (
                <div className="mt-6 grid gap-6 md:grid-cols-2">
                  {intake.catalog.soulBursts.map((item) => (
                    <button
                      key={item.productId}
                      type="button"
                      onClick={() => toggleSoulBurst(item.productId)}
                      disabled
                      className="cursor-not-allowed rounded-[22px] border border-slate-200 bg-white px-6 py-5 text-left opacity-75"
                    >
                      <div className="flex h-full flex-col">
                        {item.imageUrl ? (
                          <div className="aspect-[4/5] overflow-hidden rounded-xl bg-slate-100">
                            <img
                              src={item.imageUrl}
                              alt={item.imageAlt || item.name}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        ) : null}

                        <div className={item.imageUrl ? 'mt-5' : ''}>
                          <h3 className="text-xl font-semibold text-slate-900">{item.name}</h3>

                          {item.description ? (
                            <p className="mt-3 text-base text-slate-500">{item.description}</p>
                          ) : null}

          <p className="mt-5 text-2xl font-bold text-slate-900">
            ${(
              getResolvedProductPriceCents(item.productId, item.priceCents ?? 0) / 100
            ).toFixed(2)}
          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      ) : null}

      {currentStep === 5 ? (
        <div className="mt-8 rounded-[28px] bg-white p-8 shadow-sm">
          <div className="space-y-8">
            <section className="rounded-[22px] border border-slate-200 p-6">
              <h2 className="text-2xl font-semibold text-slate-900">Pet Information</h2>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div>
                  <div className="text-sm font-medium text-slate-500">Pet Name</div>
                  <div className="text-lg font-semibold text-slate-900">{petName || '—'}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-500">Species</div>
                  <div className="text-lg font-semibold text-slate-900">{species || '—'}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-500">Weight</div>
                  <div className="text-lg font-semibold text-slate-900">
                    {isKioskWeightLocked
                      ? Number.isFinite(weightInLbs) && weightInLbs > 0
                        ? `${weightInLbs} lbs`
                        : '—'
                      : weight
                        ? `${weight} ${weightUnit}`
                        : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-500">Breed</div>
                  <div className="text-lg font-semibold text-slate-900">{breed || '—'}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-500">Color</div>
                  <div className="text-lg font-semibold text-slate-900">{color || '—'}</div>
                </div>
              </div>
            </section>

            <section className="rounded-[22px] border border-slate-200 p-6">
              <h2 className="text-2xl font-semibold text-slate-900">Owner Information</h2>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div>
                  <div className="text-sm font-medium text-slate-500">Owner Name</div>
                  <div className="text-lg font-semibold text-slate-900">
                    {[ownerFirstName, ownerLastName].filter(Boolean).join(' ') || '—'}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-500">Phone</div>
                  <div className="text-lg font-semibold text-slate-900">{phone || '—'}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-500">Email</div>
                  <div className="text-lg font-semibold text-slate-900">{email || '—'}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-500">Address</div>
                  <div className="text-lg font-semibold text-slate-900">
                    {[street, city, state, zip].filter(Boolean).join(', ') || '—'}
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-[22px] border border-slate-200 p-6">
              <h2 className="text-2xl font-semibold text-slate-900">Cremation</h2>
              <div className="mt-4 text-lg font-semibold text-slate-900">
                {cremationType === 'private'
                  ? 'Private Cremation'
                  : cremationType === 'general'
                    ? 'General Cremation'
                    : '—'}
              </div>
            </section>

            <section className="rounded-[22px] border border-slate-200 p-6">
              <h2 className="text-2xl font-semibold text-slate-900">Memorials</h2>
              <div className="mt-6 space-y-3">
                {Object.keys(effectiveSelectedMemorialItems).length > 0 ? (
                  Object.entries(effectiveSelectedMemorialItems).map(([productId, quantity]) => {
                    const item = getMemorialItem(productId)

                    return (
                      <div key={productId} className="text-lg font-semibold text-slate-900">
                        {(item?.name ?? productId) +
                          ` x${quantity}` +
                          (item?.includedInCremation ? ' (Included)' : '') +
                          (item && item.metadata?.includedInEmployeePet === true && quantity > 0
                            ? ' (1st included)'
                            : '')}
                      </div>
                    )
                  })
                ) : (
                  <div className="text-lg font-semibold text-slate-900">None selected</div>
                )}
              </div>
              <div className="mt-6 flex items-center justify-between rounded-[18px] bg-slate-900 px-5 py-4 text-white">
                <span className="text-base font-semibold">Selected Memorial Total</span>
                <span className="text-xl font-bold">{formattedMemorialTotal}</span>
              </div>
            </section>

          </div>
        </div>
      ) : null}

      {currentStep === 6 ? (
        <div className="mt-8 rounded-[28px] bg-white p-8 shadow-sm">
          <section className="space-y-8">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">Authorization</h2>
              <p className="mt-3 text-lg text-slate-500">
                Review the work order and confirm authorization before submitting.
              </p>
            </div>

            <label className="flex items-start gap-4 rounded-[22px] border border-slate-200 p-6">
              <input
                type="checkbox"
                checked={isAcknowledged}
                onChange={(e) => setIsAcknowledged(e.target.checked)}
                className="mt-1 h-6 w-6 rounded border-slate-300"
              />
              <span className="text-xl font-medium text-slate-900">
                I confirm that all information is accurate and I authorize Horizon Pet
                Cremation to proceed.
              </span>
            </label>

            <div>
              <label className="mb-3 block text-xl font-semibold text-slate-900">
                Signature Name
              </label>
              <input
                type="text"
                value={signatureName}
                onChange={(e) => setSignatureName(e.target.value)}
                className="w-full rounded-[22px] border border-slate-200 px-6 py-5 text-2xl"
                placeholder="Enter full name"
              />
            </div>
          </section>
        </div>
      ) : null}

      {error ? (
        <div className="mt-8 rounded-xl bg-red-100 p-5 text-xl text-red-700">
          {error}
        </div>
      ) : null}

      <div className="mt-8 flex items-center justify-between rounded-[28px] bg-white p-8 shadow-sm">
        <p className="text-xl text-slate-500">
          {currentStep === 6
            ? 'Once submitted, this work order will be finalized and sent to Horizon.'
            : 'This prototype step shell is now in place.'}
        </p>

        <div className="flex items-center gap-4">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={handleStepBack}
              className="rounded-[22px] bg-slate-200 px-8 py-5 text-2xl text-slate-900"
            >
              Back
            </button>
          ) : null}

          {currentStep < 6 ? (
            <button
              type="button"
              onClick={handleStepContinue}
              disabled={
                (currentStep === 1 && (!isStep1Valid() || continueDisabled)) ||
                (currentStep === 2 && isUsingFallbackCremationPricing)
              }
              className="rounded-[22px] bg-emerald-900 px-10 py-5 text-2xl text-white disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || !isAcknowledged || !signatureName.trim()}
              className="rounded-[22px] bg-emerald-900 px-10 py-5 text-2xl text-white disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Finalize & Submit
            </button>
          )}
        </div>
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
