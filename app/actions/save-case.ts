'use server'

import { getUserRole } from '@/lib/auth/get-user-role'
import { getClinicContextResult } from '@/lib/clinic-auth'
import { isMemorialCategory } from '@/lib/clinic-product-catalog'
import { sendNewCaseEmail } from '@/lib/notifications/send-new-case-email'
import { sendNewCaseSms } from '@/lib/notifications/send-new-case-sms'
import { createServiceRoleSupabase } from '@/lib/supabase/server'

export type SaveCasePayload = {
  clinic_name?: string
  pet_name: string
  pet_species?: string
  pet_weight?: number | string
  pet_weight_unit?: string
  pet_weight_lbs?: number
  pet_breed?: string
  pet_color?: string
  owner_name: string
  owner_phone?: string
  owner_email?: string
  owner_address?: string
  owner_city?: string
  owner_state?: string
  owner_zip?: string
  cremation_type?: string | null
  selected_memorial_items?: Array<{
    product_id: string
    name: string
    price_cents: number
  }>
  memorial_items_total_cents?: number
  case_data?: Record<string, unknown>
}

export type SaveCaseOptions = {
  clinicContextOverride?: {
    clinicId: string
  }
}

type ProductRow = {
  id: string
  name: string
  category: string
  base_price: number | string
  is_active: boolean
}

type ClinicProductRow = {
  product_id: string
  is_active: boolean
  price_override: number | string | null
  included_in_employee_pet: boolean | null
}

type CremationPricingRow = {
  cremation_type: 'private' | 'general'
  intake_type: string
  weight_min_lbs: number | null
  weight_max_lbs: number | null
  client_price: number | string | null
  is_active: boolean
}

type ClinicRow = {
  id: string
  name: string
  is_active: boolean
}

type ResolvedClinicContext = {
  clinicId: string
  clinicName: string
  userId: string | null
}

function getCaseDataClinicId(caseData: Record<string, unknown> | undefined): string | null {
  const clinicId = caseData?.clinicId

  if (typeof clinicId !== 'string') {
    return null
  }

  const normalizedClinicId = clinicId.trim()
  return normalizedClinicId ? normalizedClinicId : null
}

function toPriceCents(amount: number | string): number {
  const numericAmount = typeof amount === 'number' ? amount : Number(amount)

  if (!Number.isFinite(numericAmount)) {
    return 0
  }

  return Math.round(numericAmount * 100)
}

function getCaseDataIntakeType(caseData: Record<string, unknown> | undefined): string {
  const intakeType = caseData?.intake_type

  if (typeof intakeType !== 'string') {
    return 'standard'
  }

  const normalizedIntakeType = intakeType.trim()
  return normalizedIntakeType || 'standard'
}

function getPetWeightLbs(payload: SaveCasePayload): number | null {
  if (typeof payload.pet_weight_lbs === 'number' && Number.isFinite(payload.pet_weight_lbs)) {
    return payload.pet_weight_lbs
  }

  const rawWeight =
    typeof payload.pet_weight === 'number'
      ? payload.pet_weight
      : typeof payload.pet_weight === 'string'
        ? Number(payload.pet_weight)
        : NaN

  if (!Number.isFinite(rawWeight) || rawWeight <= 0) {
    return null
  }

  if (payload.pet_weight_unit === 'kg') {
    return Number((rawWeight * 2.20462).toFixed(2))
  }

  return rawWeight
}

function getResolvedCremationPriceCents(
  rows: CremationPricingRow[],
  cremationType: 'private' | 'general',
  intakeType: string,
  petWeightLbs: number | null
): number | null {
  const eligibleRows = rows.filter((row) => {
    if (!row.is_active || row.cremation_type !== cremationType) {
      return false
    }

    const hasBounds = row.weight_min_lbs !== null || row.weight_max_lbs !== null

    if (!hasBounds) {
      return true
    }

    if (petWeightLbs === null) {
      return false
    }

    const meetsMin = row.weight_min_lbs === null || petWeightLbs >= row.weight_min_lbs
    const meetsMax = row.weight_max_lbs === null || petWeightLbs <= row.weight_max_lbs

    return meetsMin && meetsMax
  })

  const matchingRows = eligibleRows.filter((row) => row.intake_type === intakeType)
  const fallbackRows =
    matchingRows.length > 0
      ? matchingRows
      : eligibleRows.filter((row) => row.intake_type === 'standard')

  const resolvedRow =
    fallbackRows.find((row) => row.weight_min_lbs !== null || row.weight_max_lbs !== null) ??
    fallbackRows.find((row) => row.weight_min_lbs === null && row.weight_max_lbs === null) ??
    null

  if (!resolvedRow || resolvedRow.client_price === null) {
    return null
  }

  return toPriceCents(resolvedRow.client_price)
}

export async function saveCase(payload: SaveCasePayload, options?: SaveCaseOptions) {
  const userRole = await getUserRole()
  const supabase = createServiceRoleSupabase()
  const intakeType = getCaseDataIntakeType(payload.case_data)
  const isGoodSamaritanIntake = intakeType === 'good_samaritan'
  const isSpecialMemorialInclusionIntake =
    intakeType === 'employee' || intakeType === 'donation'
  const payloadClinicContextOverride =
    userRole && (userRole.role === 'admin' || userRole.role === 'horizon_staff')
      ? getCaseDataClinicId(payload.case_data)
      : null
  const clinicContextOverride = options?.clinicContextOverride ?? (
    payloadClinicContextOverride
      ? {
          clinicId: payloadClinicContextOverride,
        }
      : undefined
  )
  let clinicContext: ResolvedClinicContext | null = null

  if (clinicContextOverride) {
    const normalizedClinicId = clinicContextOverride.clinicId.trim()

    if (!normalizedClinicId) {
      throw new Error('Clinic context override requires a clinicId')
    }

    const { data: clinic, error: clinicError } = await supabase
      .from('clinics')
      .select('id, name, is_active')
      .eq('id', normalizedClinicId)
      .maybeSingle()

    if (clinicError) {
      throw new Error('Unable to resolve clinic context')
    }

    const typedClinic = clinic as ClinicRow | null

    if (!typedClinic || !typedClinic.is_active) {
      throw new Error('Clinic is inactive')
    }

    clinicContext = {
      clinicId: typedClinic.id,
      clinicName: typedClinic.name,
      userId: userRole?.userId ?? null,
    }
  } else {
    const clinicResult = await getClinicContextResult()

    if (!clinicResult) {
      throw new Error('Authentication required')
    }

    if (clinicResult.kind === 'blocked') {
      throw new Error(clinicResult.message)
    }

    if (!userRole || userRole.role !== 'clinic_user') {
      throw new Error('Clinic user access is required')
    }

    clinicContext = {
      clinicId: clinicResult.clinic.clinicId,
      clinicName: clinicResult.clinic.clinicName,
      userId: clinicResult.clinic.userId,
    }
  }

  const unsupportedCommerceFields = [
    'selected_urn',
    'additional_urns',
    'soulburst_items',
    'memorial_items',
    'subtotal',
    'total',
  ] as const
  const hasUnsupportedCommerceFields = unsupportedCommerceFields.some((field) =>
    Object.prototype.hasOwnProperty.call(payload, field)
  )

  if (hasUnsupportedCommerceFields) {
    throw new Error(
      'Clinic intake submitted unsupported product/pricing fields that are not yet persisted server-side. This request was intentionally blocked for data integrity protection.'
    )
  }

  const submittedMemorialItems = payload.selected_memorial_items ?? []
  const submittedMemorialProductIds = submittedMemorialItems
    .map((item) => item.product_id)
    .filter((productId): productId is string => typeof productId === 'string' && productId.length > 0)
  const uniqueMemorialProductIds = [...new Set(submittedMemorialProductIds)]
  const petWeightLbs = getPetWeightLbs(payload)

  let resolvedMemorialItems: SaveCasePayload['selected_memorial_items'] = []

  if (isGoodSamaritanIntake && payload.cremation_type !== 'general') {
    throw new Error('Good Samaritan intakes must use General cremation.')
  }

  if (!isGoodSamaritanIntake && uniqueMemorialProductIds.length > 0) {
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name, category, base_price, is_active')
      .in('id', uniqueMemorialProductIds)
      .eq('is_active', true)

    if (productsError) {
      throw new Error('Unable to resolve memorial product pricing')
    }

    const { data: clinicProducts, error: clinicProductsError } = await supabase
      .from('clinic_products')
      .select('product_id, is_active, price_override, included_in_employee_pet')
      .eq('clinic_id', clinicContext.clinicId)
      .in('product_id', uniqueMemorialProductIds)

    if (clinicProductsError) {
      throw new Error('Unable to resolve clinic memorial pricing overrides')
    }

    const productMap = new Map<string, ProductRow>(
      ((products ?? []) as ProductRow[]).map((product) => [product.id, product])
    )
    const clinicProductMap = new Map<string, ClinicProductRow>(
      ((clinicProducts ?? []) as ClinicProductRow[]).map((clinicProduct) => [
        clinicProduct.product_id,
        clinicProduct,
      ])
    )
    const employeeIncludedCounts = new Map<string, number>()

    resolvedMemorialItems = submittedMemorialItems.flatMap((submittedItem) => {
      const product = productMap.get(submittedItem.product_id)

      if (!product || !isMemorialCategory(product.category)) {
        return []
      }

      const clinicOverride = clinicProductMap.get(product.id)

      if (clinicOverride && clinicOverride.is_active !== true) {
        return []
      }

      const resolvedPriceCents =
        clinicOverride && clinicOverride.price_override !== null
          ? toPriceCents(clinicOverride.price_override)
          : toPriceCents(product.base_price)
      const isEmployeeIncluded =
        isSpecialMemorialInclusionIntake && clinicOverride?.included_in_employee_pet === true
      const currentCount = employeeIncludedCounts.get(product.id) ?? 0

      employeeIncludedCounts.set(product.id, currentCount + 1)

      return [
        {
          product_id: product.id,
          name: product.name,
          price_cents: isEmployeeIncluded && currentCount === 0 ? 0 : resolvedPriceCents,
        },
      ]
    })
  }

  const memorialSubtotalCents = resolvedMemorialItems.reduce(
    (sum, item) => sum + item.price_cents,
    0
  )
  let cremationSubtotalCents = 0

  if (payload.cremation_type === 'private' || payload.cremation_type === 'general') {
    const { data: cremationPricingRows, error: cremationPricingError } = await supabase
      .from('cremation_pricing')
      .select(
        'cremation_type, intake_type, weight_min_lbs, weight_max_lbs, client_price, is_active'
      )
      .eq('clinic_id', clinicContext.clinicId)

    if (cremationPricingError) {
      throw new Error('Unable to resolve cremation pricing')
    }

    const resolvedCremationPriceCents = getResolvedCremationPriceCents(
      (cremationPricingRows ?? []) as CremationPricingRow[],
      payload.cremation_type,
      intakeType,
      petWeightLbs
    )

    if (resolvedCremationPriceCents === null) {
      throw new Error('Unable to resolve cremation pricing for this intake.')
    }

    cremationSubtotalCents = resolvedCremationPriceCents
  }

  const subtotalCents = memorialSubtotalCents + cremationSubtotalCents
  const subtotalDollars = subtotalCents > 0 ? subtotalCents / 100 : 0

  const {
    case_number: _ignoredCaseNumber,
    ...restPayload
  } = payload as SaveCasePayload & { case_number?: string }
  const { data, error } = await supabase.rpc('create_case_with_initial_event', {
    clinic_id: clinicContext.clinicId,
    clinic_name: clinicContext.clinicName,
    created_by: clinicContext.userId,
    pet_name: restPayload.pet_name,
    pet_species: restPayload.pet_species ?? null,
    pet_weight:
      restPayload.pet_weight === undefined || restPayload.pet_weight === null
        ? null
        : String(restPayload.pet_weight),
    pet_weight_unit: restPayload.pet_weight_unit ?? null,
    pet_weight_lbs: restPayload.pet_weight_lbs ?? null,
    pet_breed: restPayload.pet_breed ?? null,
    pet_color: restPayload.pet_color ?? null,
    owner_name: restPayload.owner_name,
    owner_phone: restPayload.owner_phone ?? null,
    owner_email: restPayload.owner_email ?? null,
    owner_address: restPayload.owner_address ?? null,
    owner_city: restPayload.owner_city ?? null,
    owner_state: restPayload.owner_state ?? null,
    owner_zip: restPayload.owner_zip ?? null,
    cremation_type: isGoodSamaritanIntake ? 'general' : restPayload.cremation_type ?? null,
    memorial_items: isGoodSamaritanIntake ? [] : resolvedMemorialItems,
    case_data: restPayload.case_data ?? null,
    subtotal: subtotalDollars,
  })

  if (error) {
    console.error('Error creating case via RPC:', error)
    throw new Error(`Unable to create case: ${error.message}`)
  }

  const createdCase = Array.isArray(data) ? data[0] : data
  const createdCaseId =
    createdCase && typeof createdCase.id === 'string' ? createdCase.id.trim() : ''

  if (!createdCase || !createdCaseId) {
    throw new Error('Case was created without a valid id.')
  }

  console.log('Case inserted with ID:', createdCaseId, 'Case Number:', createdCase?.case_number)

  if (typeof createdCase?.case_number === 'string' && createdCase.case_number.trim()) {
    sendNewCaseEmail({
      caseNumber: createdCase.case_number,
      clinicName: clinicContext.clinicName,
      petName: payload.pet_name,
    })
    await sendNewCaseSms({
      caseNumber: createdCase.case_number,
      clinicName: clinicContext.clinicName,
      petName: payload.pet_name ?? null,
    })
  }

  return { id: createdCaseId, caseNumber: createdCase?.case_number }
}
