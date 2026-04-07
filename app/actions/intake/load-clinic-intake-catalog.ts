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
  ClinicIntakeResolvedCremationPricingRow,
  ClinicIntakeResolvedPricing,
  ClinicIntakeResolvedProductPricingRow,
  ClinicIntakeResolvedPricingSource,
  ClinicResolvedProduct,
  ClinicResolvedService,
} from '@/lib/intake/types'

type LoadClinicIntakeCatalogOptions = {
  clinicContextOverride?: {
    clinicId: string
  }
}

type LoadClinicIntakeCatalogResult = Omit<ClinicIntakeCatalog, 'clinic'> & {
  clinic: ClinicIntakeCatalog['clinic'] & {
    allows_donation_intake: boolean
  }
}

type ClinicRow = {
  id: string
  name: string
  code: string | null
  logo_path: string | null
  logo_alt_text: string | null
  allows_donation_intake: boolean
  is_active: boolean
}

type ProductRow = {
  id: string
  name: string
  category: string
  description: string | null
  base_price: number
  horizon_invoice_price: number | null
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
  horizon_invoice_price_override: number | null
  included_in_cremation: boolean | null
  included_in_employee_pet: boolean | null
}

type OverrideMapValue = {
  is_active: boolean
  price_override: number | null
  horizon_invoice_price_override: number | null
  included_in_cremation: boolean | null
  included_in_employee_pet: boolean | null
}

type ResolvedProductRow = {
  productId: string
  name: string
  category: 'memorial' | 'premium_urn' | 'soulburst' | 'add_on'
  description: string | null
  image_path: string | null
  image_alt_text: string | null
  included_by_default: boolean
  sort_order: number
  effectiveIsActive: boolean
  effectiveBasePrice: number
  effectiveHorizonInvoicePrice: number | null
  includedInCremation: boolean
  includedInEmployeePet: boolean
  pricingSource: ClinicIntakeResolvedPricingSource
}

type CremationPricingRow = {
  id: string
  clinic_id: string | null
  cremation_type: 'private' | 'general'
  intake_type: string
  weight_min_lbs: number | null
  weight_max_lbs: number | null
  client_price: number | null
  horizon_invoice_price: number | null
  is_active: boolean
  sort_order: number
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

function toNullablePriceCents(amount: number | null): number | null {
  return typeof amount === 'number' ? toPriceCents(amount) : null
}

function getResolvedPricingSource(priceOverride: number | null): ClinicIntakeResolvedPricingSource {
  return priceOverride !== null ? 'clinic_override' : 'catalog_base_price'
}

async function getImageUrl(imagePath: string | null) {
  if (!imagePath) {
    return null
  }

  const supabase = createServiceRoleSupabase()
  const { data } = supabase.storage.from('product-images').getPublicUrl(imagePath)
  return data.publicUrl
}

async function mapResolvedProduct(
  product: NormalizedResolvedProduct & {
    includedInCremation?: boolean | null
    included_in_cremation?: boolean | null
    includedInEmployeePet?: boolean | null
    included_in_employee_pet?: boolean | null
  }
): Promise<ClinicResolvedProduct> {
  const includedInCremation =
    product.included_in_cremation !== null && product.included_in_cremation !== undefined
      ? product.included_in_cremation
      : product.includedInCremation !== null && product.includedInCremation !== undefined
        ? product.includedInCremation
        : product.category === 'memorial'
          ? product.included_by_default
          : false
  const includedInEmployeePet =
    product.included_in_employee_pet !== null && product.included_in_employee_pet !== undefined
      ? product.included_in_employee_pet
      : product.includedInEmployeePet !== null && product.includedInEmployeePet !== undefined
        ? product.includedInEmployeePet
        : false

  return {
    productId: product.productId,
    sku: null,
    name: product.name,
    category: product.category,
    description: product.description,
    priceCents: toPriceCents(product.effectiveBasePrice),
    imageUrl: await getImageUrl(product.image_path),
    imageAlt: product.image_alt_text,
    isIncludedByDefault: product.included_by_default,
    includedInCremation,
    sortOrder: product.sort_order,
    metadata: {
      includedInEmployeePet,
    } as unknown as ClinicResolvedProduct['metadata'],
  }
}

export async function loadClinicIntakeCatalog(
  options?: LoadClinicIntakeCatalogOptions
): Promise<LoadClinicIntakeCatalogResult> {
  const clinicContextOverride = options?.clinicContextOverride
  let clinicContext = clinicContextOverride
    ? {
        clinicId: clinicContextOverride.clinicId.trim(),
      }
    : null

  if (clinicContextOverride && !clinicContext?.clinicId) {
    throw new Error('Clinic context override requires a clinicId')
  }

  if (!clinicContext) {
    const clinicResult = await getClinicContextResult()

    if (!clinicResult) {
      throw new Error('Authentication required')
    }

    if (clinicResult.kind === 'blocked') {
      throw new Error('Clinic access blocked')
    }

    clinicContext = {
      clinicId: clinicResult.clinic.clinicId,
    }
  }

  const supabase = createServiceRoleSupabase()

  const { data: clinic, error: clinicError } = await supabase
    .from('clinics')
    .select('id, name, code, logo_path, logo_alt_text, allows_donation_intake, is_active')
    .eq('id', clinicContext.clinicId)
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
      'id, name, category, description, base_price, horizon_invoice_price, image_path, image_alt_text, is_active, sort_order, included_by_default'
    )
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (productsError) {
    throw new Error(
      `Failed to load products: ${productsError.message} (code: ${productsError.code ?? 'unknown'}, details: ${productsError.details ?? 'none'}, hint: ${productsError.hint ?? 'none'})`
    )
  }

  const typedProducts: ProductRow[] = (products ?? []) as ProductRow[]

  const { data: clinicProducts, error: clinicProductsError } = await supabase
    .from('clinic_products')
    .select(
      'clinic_id, product_id, is_active, price_override, horizon_invoice_price_override, included_in_cremation, included_in_employee_pet'
    )
    .eq('clinic_id', clinicContext.clinicId)

  if (clinicProductsError) {
    throw new Error(
      `Failed to load clinic product overrides: ${clinicProductsError.message} (code: ${clinicProductsError.code ?? 'unknown'}, details: ${clinicProductsError.details ?? 'none'}, hint: ${clinicProductsError.hint ?? 'none'})`
    )
  }

  const typedClinicProducts: ClinicProductRow[] = (clinicProducts ?? []) as ClinicProductRow[]

  const overrideMap = new Map<string, OverrideMapValue>(
    typedClinicProducts.map((clinicProduct) => [
      clinicProduct.product_id,
      {
        is_active: clinicProduct.is_active,
        price_override: clinicProduct.price_override,
        horizon_invoice_price_override: clinicProduct.horizon_invoice_price_override,
        included_in_cremation: clinicProduct.included_in_cremation,
        included_in_employee_pet: clinicProduct.included_in_employee_pet,
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
    const effectiveHorizonInvoicePrice =
      override && override.horizon_invoice_price_override !== null
        ? override.horizon_invoice_price_override
        : product.horizon_invoice_price
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
      return null
    }

    const includedInCremation =
      override?.included_in_cremation !== null && override?.included_in_cremation !== undefined
        ? override.included_in_cremation
        : normalizedCategory === 'memorial'
          ? product.included_by_default
          : false
    const includedInEmployeePet =
      override?.included_in_employee_pet !== null && override?.included_in_employee_pet !== undefined
        ? override.included_in_employee_pet
        : false

    return {
      productId: product.id,
      name: product.name,
      category: normalizedCategory,
      description: product.description,
      image_path: product.image_path,
      image_alt_text: product.image_alt_text,
      included_by_default: product.included_by_default,
      sort_order: product.sort_order,
      effectiveIsActive,
      effectiveBasePrice,
      effectiveHorizonInvoicePrice,
      includedInCremation,
      includedInEmployeePet,
      pricingSource: getResolvedPricingSource(override?.price_override ?? null),
    }
  }).filter((product): product is ResolvedProductRow => product !== null)

  const activeResolvedProducts: ResolvedProductRow[] = resolvedProducts.filter(
    (product) => product.effectiveIsActive === true
  )

  const normalizedProducts: NormalizedResolvedProduct[] = activeResolvedProducts.flatMap(
    (product) => [
      {
        productId: product.productId,
        name: product.name,
        category: product.category,
        description: product.description,
        image_path: product.image_path,
        image_alt_text: product.image_alt_text,
        included_by_default: product.included_by_default,
        sort_order: product.sort_order,
        effectiveBasePrice: product.effectiveBasePrice,
      },
    ]
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

  const resolvedMemorialItems: ClinicResolvedProduct[] = await Promise.all(
    memorialItems.map(mapResolvedProduct)
  )
  const resolvedPremiumUrns: ClinicResolvedProduct[] = await Promise.all(
    premiumUrns.map(mapResolvedProduct)
  )
  const resolvedSoulBursts: ClinicResolvedProduct[] = await Promise.all(
    soulBursts.map(mapResolvedProduct)
  )
  const resolvedAddOns: ClinicResolvedProduct[] = await Promise.all(addOns.map(mapResolvedProduct))
  const services: ClinicResolvedService[] = []
  const { data: cremationPricingRows, error: cremationPricingError } = await supabase
    .from('cremation_pricing')
    .select(
      'id, clinic_id, cremation_type, intake_type, weight_min_lbs, weight_max_lbs, client_price, horizon_invoice_price, is_active, sort_order'
    )
    .eq('clinic_id', clinicContext.clinicId)
    .order('sort_order', { ascending: true })
    .order('cremation_type', { ascending: true })

  if (cremationPricingError) {
    throw new Error(
      `Failed to load cremation pricing: ${cremationPricingError.message} (code: ${cremationPricingError.code ?? 'unknown'}, details: ${cremationPricingError.details ?? 'none'}, hint: ${cremationPricingError.hint ?? 'none'})`
    )
  }

  const typedCremationPricingRows: CremationPricingRow[] =
    (cremationPricingRows ?? []) as CremationPricingRow[]
  const cremationPricing: ClinicIntakeResolvedCremationPricingRow[] =
    typedCremationPricingRows.length > 0
      ? typedCremationPricingRows.map((row) => ({
          key: row.id,
          cremationType: row.cremation_type,
          weightClassLabel:
            row.weight_min_lbs === null && row.weight_max_lbs === null
              ? 'Unbounded'
              : row.weight_min_lbs !== null && row.weight_max_lbs !== null
                ? `${row.weight_min_lbs}-${row.weight_max_lbs} lbs`
                : row.weight_min_lbs !== null
                  ? `${row.weight_min_lbs}+ lbs`
                  : `Up to ${row.weight_max_lbs} lbs`,
          weightMinLbs: row.weight_min_lbs,
          weightMaxLbs: row.weight_max_lbs,
          pricingSource: 'clinic_override',
          clientVisiblePriceCents: toNullablePriceCents(row.client_price),
          horizonInternalPriceCents: toNullablePriceCents(row.horizon_invoice_price),
          active: row.is_active,
          currency: 'USD',
          metadata: {
            clinicId: row.clinic_id,
            intakeType: row.intake_type,
            sortOrder: row.sort_order,
          },
        }))
      : [
          {
            key: 'private-unconfigured',
            cremationType: 'private',
            weightClassLabel: 'Unconfigured',
            weightMinLbs: null,
            weightMaxLbs: null,
            pricingSource: 'unavailable',
            clientVisiblePriceCents: null,
            horizonInternalPriceCents: null,
            active: false,
            currency: 'USD',
            metadata: {},
          },
          {
            key: 'general-unconfigured',
            cremationType: 'general',
            weightClassLabel: 'Unconfigured',
            weightMinLbs: null,
            weightMaxLbs: null,
            pricingSource: 'unavailable',
            clientVisiblePriceCents: null,
            horizonInternalPriceCents: null,
            active: false,
            currency: 'USD',
            metadata: {},
          },
        ]
  const productPricing: ClinicIntakeResolvedProductPricingRow[] = activeResolvedProducts.map(
    (product) => ({
      productId: product.productId,
      category: product.category,
      name: product.name,
      pricingSource: product.pricingSource,
      clientVisiblePriceCents: toPriceCents(product.effectiveBasePrice),
      horizonInternalPriceCents: toNullablePriceCents(product.effectiveHorizonInvoicePrice),
      visibleToClinic: product.effectiveIsActive,
      shownInClientIntake: true,
      includedInCremation: product.includedInCremation,
      currency: 'USD',
      metadata: {
        isIncludedByDefault: product.included_by_default,
        includedInEmployeePet: product.includedInEmployeePet,
      } as ClinicIntakeResolvedProductPricingRow['metadata'],
    })
  )
  const pricing: ClinicIntakeResolvedPricing = {
    profile: {
      scope: 'clinic',
      sourceClinicId: typedClinic.id,
      sourceClinicCode: typedClinic.code,
    },
    cremationPricing,
    productPricing,
    resolvedAt: new Date().toISOString(),
    resolverVersion: 'clinic-intake-catalog-v1',
  }

  return {
    clinic: {
      id: typedClinic.id,
      name: typedClinic.name,
      code: typedClinic.code,
      logoUrl: typedClinic.logo_path,
      logoAlt: typedClinic.logo_alt_text,
      allows_donation_intake: typedClinic.allows_donation_intake,
    },
    services,
    memorialItems: resolvedMemorialItems,
    premiumUrns: resolvedPremiumUrns,
    soulBursts: resolvedSoulBursts,
    addOns: resolvedAddOns,
    pricing,
  }
}
