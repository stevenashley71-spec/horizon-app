export const PRODUCT_CATEGORY = {
  PREMIUM_URN: 'premium_urn',
  MEMORIAL_ITEM: 'memorial_item',
  SOULBURST: 'soulburst',
  ADD_ON: 'add_on',
} as const

export type ProductCategory = (typeof PRODUCT_CATEGORY)[keyof typeof PRODUCT_CATEGORY]

export const PRODUCT_CATEGORY_OPTIONS: Array<{
  label: string
  value: ProductCategory
}> = [
  { label: 'Premium Urn', value: PRODUCT_CATEGORY.PREMIUM_URN },
  { label: 'Memorial Item', value: PRODUCT_CATEGORY.MEMORIAL_ITEM },
  { label: 'SoulBurst', value: PRODUCT_CATEGORY.SOULBURST },
  { label: 'Add-On', value: PRODUCT_CATEGORY.ADD_ON },
]

export type ClinicAvailableProduct = {
  id: string
  name: string
  category: ProductCategory
  description: string | null
  price: number
  imageUrl: string | null
  sortOrder: number
  includedByDefault: boolean
}

export function isProductCategory(category: string): category is ProductCategory {
  return PRODUCT_CATEGORY_OPTIONS.some((option) => option.value === category)
}

export function isMemorialCategory(category: string) {
  return category === PRODUCT_CATEGORY.MEMORIAL_ITEM
}

export function isPremiumUrnCategory(category: string) {
  return category === PRODUCT_CATEGORY.PREMIUM_URN
}

export function isSoulburstCategory(category: string) {
  return category === PRODUCT_CATEGORY.SOULBURST
}

export function isAddOnCategory(category: string) {
  return category === PRODUCT_CATEGORY.ADD_ON
}
