export type IntakePetSnapshot = {
  petName: string | null
  species: 'dog' | 'cat' | 'other' | null
  breed: string | null
  color: string | null
  sex: string | null
  weightLbs: number | null
  weightKg: number | null
  dateOfDeath: string | null
  microchipNumber: string | null
  notes: string | null
}

export type IntakeOwnerSnapshot = {
  ownerName: string | null
  coOwnerName: string | null
  phone: string | null
  email: string | null
  addressLine1: string | null
  addressLine2: string | null
  city: string | null
  state: string | null
  postalCode: string | null
  authorizationRelationship: string | null
  notes: string | null
}

export type IntakeServiceSnapshot = {
  cremationType: 'private' | 'general' | null
  returnAshes: boolean | null
  packageId: string | null
  packageName: string | null
  serviceProductId: string | null
  specialInstructions: string | null
  acknowledgmentFlags: {
    privateConfirmed?: boolean
    generalConfirmed?: boolean
    noReturnConfirmed?: boolean
  }
}

export type IntakeSelectedProduct = {
  productId: string
  productType: 'memorial' | 'urn' | 'soulburst' | 'add_on'
  name: string
  quantity: number
  unitPriceCents: number
  totalPriceCents: number
  metadata?: Record<string, unknown>
}

export type IntakeProductSnapshot = {
  memorial_items: {
    product_id: string
    name: string
    price_cents: number
  }[]
  memorial_items_total_cents: number
  premium_urns?: unknown[]
  add_ons?: unknown[]
}

export type IntakePricingSnapshot = {
  currency: 'USD'
  subtotalCents: number
  taxCents: number
  totalCents: number
  lineItems: Array<{
    key: string
    label: string
    amountCents: number
    source: 'service' | 'product' | 'override'
  }>
  resolvedAt: string | null
  resolverVersion: string | null
}

export type IntakeSignatureSnapshot = {
  signed: boolean
  signedByName: string | null
  signedAt: string | null
  signatureDataUrl: string | null
  signerIp: string | null
  signerUserAgent: string | null
  invalidatedAt: string | null
  invalidationReason: string | null
}

export type IntakeValidationSnapshot = {
  isValidForSubmit: boolean
  missingFields: string[]
  blockingIssues: string[]
  warnings: string[]
  validatedAt: string | null
}

export type IntakeDraftStatus =
  | 'draft'
  | 'client_review'
  | 'ready_for_submission'
  | 'submitted'
  | 'abandoned'

export type IntakeSource = 'clinic_staff' | 'client_mode'

export type ClinicResolvedService = {
  productId: string
  code: string
  name: string
  cremationType: 'private' | 'general'
  description: string | null
  priceCents: number
  active: boolean
  sortOrder: number
}

export type ClinicResolvedProduct = {
  productId: string
  sku: string | null
  name: string
  description: string | null
  category: 'memorial' | 'premium_urn' | 'soulburst' | 'add_on'
  priceCents: number
  imageUrl: string | null
  imageAlt: string | null
  isIncludedByDefault: boolean
  sortOrder: number
  metadata: Record<string, never>
}

export type ClinicIntakeCatalog = {
  clinic: {
    id: string
    name: string
    code: string | null
    logoUrl: string | null
    logoAlt: string | null
  }
  services: ClinicResolvedService[]
  memorialItems: ClinicResolvedProduct[]
  premiumUrns: ClinicResolvedProduct[]
  soulBursts: ClinicResolvedProduct[]
  addOns: ClinicResolvedProduct[]
}
