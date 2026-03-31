'use server'

import { getClinicContextResult } from '@/lib/clinic-auth'
import {
  isAddOnCategory,
  isMemorialCategory,
  isPremiumUrnCategory,
  isSoulburstCategory,
} from '@/lib/clinic-product-catalog'
import { createServiceRoleSupabase } from '@/lib/supabase/server'

import type {
  ClinicIntakeCatalog,
  ClinicResolvedProduct,
  ClinicResolvedService,
} from '@/lib/intake/types'

type ClinicRow = {
  id: string
  name: string
  code: string | null
  logo_path: string | null
  logo_alt_text: string | null
  is_active: boolean
}

type ProductRow = {
  id: string
  name: string
  category: string
  description: string | null
  base_price: number
  image_path: string | null
  image_alt_text: string | null
  is_active: boolean
  sort_order: number
  included_by_default: boolean
}

type ClinicProductRow = {
  clinic_id: string
  product_id: string
  is_active: boolean
  price_override: number | null
}

type OverrideMapValue = {
  is_active: boolean
  price_override: number | null
}

type ResolvedProductRow = {
  productId: string
  name: string
  category: string
  description: string | null
  image_path: string | null
  image_alt_text: string | null
  included_by_default: boolean
  sort_order: number
  effectiveIsActive: boolean
  effectiveBasePrice: number
}

type NormalizedResolvedProduct = {
  productId: string
  name: string
  category: 'memorial' | 'premium_urn' | 'soulburst' | 'add_on'
  description: string | null
  image_path: string | null
  image_alt_text: string | null
  included_by_default: boolean
  sort_order: number
  effectiveBasePrice: number
}

function toPriceCents(amount: number): number {
  return Math.round(amount * 100)
}

function mapResolvedProduct(product: NormalizedResolvedProduct): ClinicResolvedProduct {
  return {
    productId: product.productId,
    sku: null,
    name: product.name,
    category: product.category,
    description: product.description,
    priceCents: toPriceCents(product.effectiveBasePrice),
    imageUrl: product.image_path,
    imageAlt: product.image_alt_text,
    isIncludedByDefault: product.included_by_default,
    sortOrder: product.sort_order,
    metadata: {},
  }
}

export async function loadClinicIntakeCatalog(): Promise<ClinicIntakeCatalog> {
  const clinicResult = await getClinicContextResult()

  if (!clinicResult) {
    throw new Error('Authentication required')
  }

  if (clinicResult.kind === 'blocked') {
    throw new Error('Clinic access blocked')
  }

  const supabase = createServiceRoleSupabase()

  const { data: clinic, error: clinicError } = await supabase
    .from('clinics')
    .select('id, name, code, logo_path, logo_alt_text, is_active')
    .eq('id', clinicResult.clinic.clinicId)
    .maybeSingle()

  if (clinicError) {
    throw new Error('Failed to load clinic')
  }

  if (!clinic) {
    throw new Error('Clinic not found')
  }

  const typedClinic: ClinicRow = clinic

  if (!typedClinic.is_active) {
    throw new Error('Clinic is inactive')
  }

  const { data: products, error: productsError } = await supabase
    .from('products')
    .select(
      'id, name, category, description, base_price, image_path, image_alt_text, is_active, sort_order, included_by_default'
    )
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (productsError) {
    throw new Error('Failed to load products')
  }

  const typedProducts: ProductRow[] = (products ?? []) as ProductRow[]

  const { data: clinicProducts, error: clinicProductsError } = await supabase
    .from('clinic_products')
    .select('clinic_id, product_id, is_active, price_override')
    .eq('clinic_id', clinicResult.clinic.clinicId)

  if (clinicProductsError) {
    throw new Error('Failed to load clinic product overrides')
  }

  const typedClinicProducts: ClinicProductRow[] = (clinicProducts ?? []) as ClinicProductRow[]

  const overrideMap = new Map<string, OverrideMapValue>(
    typedClinicProducts.map((clinicProduct) => [
      clinicProduct.product_id,
      {
        is_active: clinicProduct.is_active,
        price_override: clinicProduct.price_override,
      },
    ])
  )

  const resolvedProducts: ResolvedProductRow[] = typedProducts.map((product) => {
    const override = overrideMap.get(product.id)
    const effectiveIsActive = override ? override.is_active : true
    const effectiveBasePrice =
      override && override.price_override !== null
        ? override.price_override
        : product.base_price

    return {
      productId: product.id,
      name: product.name,
      category: product.category,
      description: product.description,
      image_path: product.image_path,
      image_alt_text: product.image_alt_text,
      included_by_default: product.included_by_default,
      sort_order: product.sort_order,
      effectiveIsActive,
      effectiveBasePrice,
    }
  })

  const activeResolvedProducts: ResolvedProductRow[] = resolvedProducts.filter(
    (product) => product.effectiveIsActive === true
  )

  const normalizedProducts: NormalizedResolvedProduct[] = activeResolvedProducts.flatMap(
    (product) => {
      const normalizedCategory = isMemorialCategory(product.category)
        ? 'memorial'
        : isPremiumUrnCategory(product.category)
          ? 'premium_urn'
          : isSoulburstCategory(product.category)
            ? 'soulburst'
            : isAddOnCategory(product.category)
              ? 'add_on'
              : null

      if (!normalizedCategory) {
        return []
      }

      return [
        {
          productId: product.productId,
          name: product.name,
          category: normalizedCategory,
          description: product.description,
          image_path: product.image_path,
          image_alt_text: product.image_alt_text,
          included_by_default: product.included_by_default,
          sort_order: product.sort_order,
          effectiveBasePrice: product.effectiveBasePrice,
        },
      ]
    }
  )

  const memorialItems: NormalizedResolvedProduct[] = normalizedProducts.filter(
    (product) => product.category === 'memorial'
  )
  const premiumUrns: NormalizedResolvedProduct[] = normalizedProducts.filter(
    (product) => product.category === 'premium_urn'
  )
  const soulBursts: NormalizedResolvedProduct[] = normalizedProducts.filter(
    (product) => product.category === 'soulburst'
  )
  const addOns: NormalizedResolvedProduct[] = normalizedProducts.filter(
    (product) => product.category === 'add_on'
  )

  const resolvedMemorialItems: ClinicResolvedProduct[] = memorialItems.map(mapResolvedProduct)
  const resolvedPremiumUrns: ClinicResolvedProduct[] = premiumUrns.map(mapResolvedProduct)
  const resolvedSoulBursts: ClinicResolvedProduct[] = soulBursts.map(mapResolvedProduct)
  const resolvedAddOns: ClinicResolvedProduct[] = addOns.map(mapResolvedProduct)
  const services: ClinicResolvedService[] = []

  return {
    clinic: {
      id: typedClinic.id,
      name: typedClinic.name,
      code: typedClinic.code,
      logoUrl: typedClinic.logo_path,
      logoAlt: typedClinic.logo_alt_text,
    },
    services,
    memorialItems: resolvedMemorialItems,
    premiumUrns: resolvedPremiumUrns,
    soulBursts: resolvedSoulBursts,
    addOns: resolvedAddOns,
  }
}
