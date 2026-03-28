'use server'

import { revalidatePath } from 'next/cache'

import { requireTemporaryHorizonAdmin } from '@/lib/admin-auth'
import { isProductCategory } from '@/lib/clinic-product-catalog'
import { createServiceRoleSupabase } from '@/lib/supabase/server'

export async function saveProductAdmin(formData: FormData) {
  await requireTemporaryHorizonAdmin()

  const supabase = createServiceRoleSupabase()

  const productIdValue = formData.get('product_id')
  const productId = typeof productIdValue === 'string' && productIdValue ? productIdValue : null
  const name = String(formData.get('name') ?? '').trim()
  const category = String(formData.get('category') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim() || null
  const basePriceValue = String(formData.get('base_price') ?? '').trim()
  const sortOrderValue = String(formData.get('sort_order') ?? '').trim()
  const isActive = String(formData.get('is_active') ?? '') === 'true'
  const includedByDefault = String(formData.get('included_by_default') ?? '') === 'true'
  const imagePath = String(formData.get('image_path') ?? '').trim() || null
  const imageAltText = String(formData.get('image_alt_text') ?? '').trim() || null

  if (!name) {
    throw new Error('Product name is required')
  }

  if (!category) {
    throw new Error('Product category is required')
  }

  if (!isProductCategory(category)) {
    throw new Error('Product category must be one of the supported category values')
  }

  const basePrice = Number(basePriceValue)
  if (!Number.isFinite(basePrice) || basePrice < 0) {
    throw new Error('Base price must be a valid non-negative number')
  }

  const sortOrder = sortOrderValue ? Number(sortOrderValue) : 0
  if (!Number.isInteger(sortOrder)) {
    throw new Error('Sort order must be a whole number')
  }

  const baseFields = {
    name,
    category,
    description,
    base_price: basePrice,
    is_active: isActive,
    included_by_default: includedByDefault,
    sort_order: sortOrder,
    image_path: imagePath,
    image_alt_text: imageAltText,
    updated_at: new Date().toISOString(),
  }

  if (productId) {
    const { error } = await supabase
      .from('products')
      .update(baseFields)
      .eq('id', productId)

    if (error) {
      throw new Error(error.message)
    }
  } else {
    const { error } = await supabase
      .from('products')
      .insert(baseFields)

    if (error) {
      throw new Error(error.message)
    }
  }

  revalidatePath('/admin/products')

  return { success: true }
}

export async function setProductActive(productId: string, isActive: boolean) {
  await requireTemporaryHorizonAdmin()

  const supabase = createServiceRoleSupabase()

  const { error } = await supabase
    .from('products')
    .update({
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq('id', productId)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/admin/products')

  return { success: true }
}
