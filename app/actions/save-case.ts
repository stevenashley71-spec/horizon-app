'use server'

import { getUserRole } from '@/lib/auth/get-user-role'
import { getClinicContextResult } from '@/lib/clinic-auth'
import { isMemorialCategory } from '@/lib/clinic-product-catalog'
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
}

function toPriceCents(amount: number | string): number {
  const numericAmount = typeof amount === 'number' ? amount : Number(amount)

  if (!Number.isFinite(numericAmount)) {
    return 0
  }

  return Math.round(numericAmount * 100)
}

export async function saveCase(payload: SaveCasePayload) {
  const userRole = await getUserRole()
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

  const supabase = createServiceRoleSupabase()
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

  let resolvedMemorialItems: SaveCasePayload['selected_memorial_items'] = []

  if (uniqueMemorialProductIds.length > 0) {
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
      .select('product_id, is_active, price_override')
      .eq('clinic_id', clinicResult.clinic.clinicId)
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

      return [
        {
          product_id: product.id,
          name: product.name,
          price_cents: resolvedPriceCents,
        },
      ]
    })
  }

  const memorialSubtotalCents = resolvedMemorialItems.reduce(
    (sum, item) => sum + item.price_cents,
    0
  )
  const memorialSubtotalDollars =
    resolvedMemorialItems.length > 0 ? memorialSubtotalCents / 100 : null

  const {
    case_number: _ignoredCaseNumber,
    ...restPayload
  } = payload as SaveCasePayload & { case_number?: string }
  const { data, error } = await supabase.rpc('create_case_with_initial_event', {
    clinic_id: clinicResult.clinic.clinicId,
    clinic_name: clinicResult.clinic.clinicName,
    created_by: clinicResult.clinic.userId,
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
    cremation_type: restPayload.cremation_type ?? null,
    memorial_items: resolvedMemorialItems,
    case_data: restPayload.case_data ?? null,
    subtotal: memorialSubtotalDollars,
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

  return { id: createdCaseId, caseNumber: createdCase?.case_number }
}
