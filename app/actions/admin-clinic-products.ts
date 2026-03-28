'use server'

import { revalidatePath } from 'next/cache'

import { requireTemporaryHorizonAdmin } from '@/lib/admin-auth'
import { createServiceRoleSupabase } from '@/lib/supabase/server'

export async function saveClinicProductAvailability(formData: FormData) {
  await requireTemporaryHorizonAdmin()

  const supabase = createServiceRoleSupabase()

  const clinicId = String(formData.get('clinic_id') ?? '').trim()
  const productId = String(formData.get('product_id') ?? '').trim()
  const isActive = String(formData.get('is_active') ?? '').trim() === 'true'
  const priceOverrideValue = String(formData.get('price_override') ?? '').trim()

  if (!clinicId || !productId) {
    throw new Error('Clinic and product are required')
  }

  let priceOverride: number | null = null

  if (priceOverrideValue !== '') {
    const parsedPriceOverride = Number(priceOverrideValue)

    if (!Number.isFinite(parsedPriceOverride) || parsedPriceOverride < 0) {
      throw new Error('Price override must be a valid non-negative number')
    }

    priceOverride = parsedPriceOverride
  }

  const { error } = await supabase
    .from('clinic_products')
    .upsert(
      {
        clinic_id: clinicId,
        product_id: productId,
        is_active: isActive,
        price_override: priceOverride,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'clinic_id,product_id' }
    )

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath(`/admin/clinic-products?clinicId=${clinicId}`)
}
