'use server'

import { revalidatePath } from 'next/cache'

import { requireTemporaryHorizonAdmin } from '@/lib/admin-auth'
import { isProductCategory } from '@/lib/clinic-product-catalog'
import { createServiceRoleSupabase } from '@/lib/supabase/server'

const PRODUCT_IMAGE_BUCKET = 'product-images'
const MAX_PRODUCT_IMAGE_SIZE_BYTES = 5 * 1024 * 1024
const SUPPORTED_PRODUCT_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
])

function slugifyFileName(fileName: string) {
  return fileName
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

async function uploadProductImage(file: File) {
  if (!(file instanceof File)) {
    throw new Error('Invalid product image upload.')
  }

  if (file.size <= 0) {
    throw new Error('Product image file is empty.')
  }

  if (!SUPPORTED_PRODUCT_IMAGE_TYPES.has(file.type)) {
    throw new Error('Product images must be JPG, PNG, WEBP, or GIF.')
  }

  if (file.size > MAX_PRODUCT_IMAGE_SIZE_BYTES) {
    throw new Error('Product images must be 5MB or smaller.')
  }

  const supabase = createServiceRoleSupabase()
  const filePath = `${Date.now()}-${slugifyFileName(file.name || 'product-image')}`
  const fileBuffer = new Uint8Array(await file.arrayBuffer())

  const { error } = await supabase.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .upload(filePath, fileBuffer, {
      contentType: file.type,
      cacheControl: '3600',
      upsert: true,
    })

  if (error) {
    throw new Error(error.message)
  }

  return filePath
}

export async function saveProductAdmin(formData: FormData) {
  try {
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
    const file = formData.get('image_file') as File | null
    const existingImagePath = String(formData.get('image_path') ?? '').trim() || null
    const imageAltText = String(formData.get('image_alt_text') ?? '').trim() || null

    if (!name) {
      throw Error('Product name is required')
    }

    if (!category) {
      throw Error('Product category is required')
    }

    if (!isProductCategory(category)) {
      throw Error('Product category must be one of the supported category values')
    }

    const basePrice = Number(basePriceValue)
    if (!Number.isFinite(basePrice) || basePrice < 0) {
      throw Error('Base price must be a valid non-negative number')
    }

    const sortOrder = sortOrderValue ? Number(sortOrderValue) : 0
    if (!Number.isInteger(sortOrder)) {
      throw Error('Sort order must be a whole number')
    }

    let imagePath = existingImagePath

    if (file && file.size > 0) {
      imagePath = await uploadProductImage(file)
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
        throw Error(error.message)
      }
    } else {
      const { error } = await supabase
        .from('products')
        .insert(baseFields)

      if (error) {
        throw Error(error.message)
      }
    }

    revalidatePath('/admin/products')

    return { success: true }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Failed to save product.',
    }
  }
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
