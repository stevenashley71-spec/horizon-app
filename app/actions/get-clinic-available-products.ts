'use server'

import { getClinicContextResult } from '@/lib/clinic-auth'
import { createServerSupabase } from '@/lib/supabase/server'
import {
  isProductCategory,
  type ClinicAvailableProduct,
  type ProductCategory,
} from '@/lib/clinic-product-catalog'

type ProductRow = {
  id: string
  name: string
  category: string
  description: string | null
  base_price: number
  image_path: string | null
  is_active: boolean
  sort_order: number
  included_by_default: boolean
}

type ClinicProductRow = {
  product_id: string
  is_active: boolean
  price_override: number | null
}

async function getImageUrl(imagePath: string | null) {
  if (!imagePath) {
    return null
  }

  const supabase = await createServerSupabase()
  const { data } = supabase.storage.from('product-images').getPublicUrl(imagePath)
  return data.publicUrl
}

export async function getClinicAvailableProducts(clinicId: string): Promise<ClinicAvailableProduct[]> {
  const clinicResult = await getClinicContextResult()

  if (!clinicResult) {
    throw new Error('Authentication required')
  }

  if (clinicResult.kind === 'blocked') {
    throw new Error(clinicResult.message)
  }

  const authenticatedClinicId = clinicResult.clinic.clinicId

  if (clinicId && clinicId !== authenticatedClinicId) {
    throw new Error('You do not have permission to view products for this clinic')
  }

  const supabase = await createServerSupabase()

  const { data: products, error: productsError } = await supabase
    .from('products')
    .select(
      'id, name, category, description, base_price, image_path, is_active, sort_order, included_by_default'
    )
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (productsError) {
    throw new Error(productsError.message)
  }

  const { data: overrides, error: overridesError } = await supabase
    .from('clinic_products')
    .select('product_id, is_active, price_override')
    .eq('clinic_id', authenticatedClinicId)

  if (overridesError) {
    throw new Error(overridesError.message)
  }

  const overrideMap = new Map(
    ((overrides as ClinicProductRow[] | null) ?? []).map((override) => [override.product_id, override])
  )

  const availableProducts = await Promise.all(
    ((products as ProductRow[] | null) ?? []).map(async (product) => {
      if (!isProductCategory(product.category)) {
        return null
      }

      const override = overrideMap.get(product.id)
      const isActive = override ? override.is_active : product.is_active

      if (!isActive) {
        return null
      }

      return {
        id: product.id,
        name: product.name,
        category: product.category as ProductCategory,
        description: product.description,
        price: override?.price_override ?? product.base_price,
        imageUrl: await getImageUrl(product.image_path),
        sortOrder: product.sort_order,
        includedByDefault: product.included_by_default,
      } satisfies ClinicAvailableProduct
    })
  )

  return availableProducts
    .filter((product): product is ClinicAvailableProduct => product !== null)
}
