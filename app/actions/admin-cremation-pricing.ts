'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireTemporaryHorizonAdmin } from '@/lib/admin-auth'
import { createServiceRoleSupabase } from '@/lib/supabase/server'

function parseNullableNonNegativeNumber(value: string, fieldLabel: string) {
  if (value === '') {
    return null
  }

  const parsed = Number(value)

  if (!Number.isFinite(parsed)) {
    throw new Error(`${fieldLabel} must be a valid number`)
  }

  if (parsed < 0) {
    throw new Error(`${fieldLabel} cannot be negative`)
  }

  return parsed
}

export async function addCremationPricingRow(clinicId: string) {
  await requireTemporaryHorizonAdmin()

  const normalizedClinicId = clinicId.trim()

  if (!normalizedClinicId) {
    throw new Error('Clinic is required')
  }

  const supabase = createServiceRoleSupabase()
  const { data: lastRow, error: lastRowError } = await supabase
    .from('cremation_pricing')
    .select('sort_order')
    .eq('clinic_id', normalizedClinicId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (lastRowError) {
    throw new Error(lastRowError.message)
  }

  const nextSortOrder =
    lastRow && typeof lastRow.sort_order === 'number' ? lastRow.sort_order + 1 : 0

  const { error } = await supabase.from('cremation_pricing').insert({
    clinic_id: normalizedClinicId,
    cremation_type: 'private',
    intake_type: 'standard',
    client_price: 0,
    horizon_invoice_price: 0,
    weight_min_lbs: 0,
    weight_max_lbs: 0,
    is_active: true,
    sort_order: nextSortOrder,
  })

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/admin/clinic-products')
  redirect(`/admin/clinic-products?clinicId=${normalizedClinicId}`)
}

export async function saveCremationPricingRow(formData: FormData) {
  await requireTemporaryHorizonAdmin()

  const id = String(formData.get('id') ?? '').trim()
  const clinicId = String(formData.get('clinic_id') ?? '').trim()
  const cremationType = String(formData.get('cremation_type') ?? '').trim()
  const intakeType = String(formData.get('intake_type') ?? 'standard').trim() || 'standard'
  const weightMinValue = String(formData.get('weight_min_lbs') ?? '').trim()
  const weightMaxValue = String(formData.get('weight_max_lbs') ?? '').trim()
  const clientPriceValue = String(formData.get('client_price') ?? '').trim()
  const horizonInvoicePriceValue = String(formData.get('horizon_invoice_price') ?? '').trim()
  const isActive = String(formData.get('is_active') ?? '').trim() === 'true'
  const sortOrderValue = String(formData.get('sort_order') ?? '').trim()

  if (!id || !clinicId) {
    throw new Error('Cremation pricing row is missing required identifiers')
  }

  if (cremationType !== 'private' && cremationType !== 'general') {
    throw new Error('Cremation type must be private or general')
  }

  if (
    intakeType !== 'standard' &&
    intakeType !== 'employee' &&
    intakeType !== 'good_samaritan' &&
    intakeType !== 'donation'
  ) {
    throw new Error('Intake type must be standard, employee, good_samaritan, or donation')
  }

  const weightMinLbs = parseNullableNonNegativeNumber(weightMinValue, 'Minimum weight')
  const weightMaxLbs = parseNullableNonNegativeNumber(weightMaxValue, 'Maximum weight')
  const clientPrice = parseNullableNonNegativeNumber(clientPriceValue, 'Client price')
  const horizonInvoicePrice = parseNullableNonNegativeNumber(
    horizonInvoicePriceValue,
    'Horizon invoice price'
  )

  if (sortOrderValue === '') {
    throw new Error('Sort order is required')
  }

  const sortOrder = Number(sortOrderValue)

  if (!Number.isFinite(sortOrder)) {
    throw new Error('Sort order must be a valid number')
  }

  if (sortOrder < 0) {
    throw new Error('Sort order cannot be negative')
  }

  const supabase = createServiceRoleSupabase()
  const { error } = await supabase.from('cremation_pricing').upsert(
    {
      id,
      clinic_id: clinicId,
      cremation_type: cremationType,
      intake_type: intakeType,
      weight_min_lbs: weightMinLbs,
      weight_max_lbs: weightMaxLbs,
      client_price: clientPrice,
      horizon_invoice_price: horizonInvoicePrice,
      is_active: isActive,
      sort_order: sortOrder,
    },
    { onConflict: 'id' }
  )

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/admin/clinic-products')
  redirect(`/admin/clinic-products?clinicId=${clinicId}`)
}
