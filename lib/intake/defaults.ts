import type {
  IntakeOwnerSnapshot,
  IntakePetSnapshot,
  IntakePricingSnapshot,
  IntakeProductSnapshot,
  IntakeServiceSnapshot,
  IntakeSignatureSnapshot,
  IntakeValidationSnapshot,
} from './types'

export const EMPTY_PET_SNAPSHOT: IntakePetSnapshot = {
  petName: null,
  species: null,
  breed: null,
  color: null,
  sex: null,
  weightLbs: null,
  weightKg: null,
  dateOfDeath: null,
  microchipNumber: null,
  notes: null,
}

export const EMPTY_OWNER_SNAPSHOT: IntakeOwnerSnapshot = {
  ownerName: null,
  coOwnerName: null,
  phone: null,
  email: null,
  addressLine1: null,
  addressLine2: null,
  city: null,
  state: null,
  postalCode: null,
  authorizationRelationship: null,
  notes: null,
}

export const EMPTY_SERVICE_SNAPSHOT: IntakeServiceSnapshot = {
  cremationType: null,
  returnAshes: null,
  packageId: null,
  packageName: null,
  serviceProductId: null,
  specialInstructions: null,
  acknowledgmentFlags: {},
}

export const EMPTY_PRODUCT_SNAPSHOT: IntakeProductSnapshot = {
  memorial_items: [],
  memorial_items_total_cents: 0,
  premium_urns: [],
  add_ons: [],
}

export const EMPTY_PRICING_SNAPSHOT: IntakePricingSnapshot = {
  currency: 'USD',
  subtotalCents: 0,
  taxCents: 0,
  totalCents: 0,
  lineItems: [],
  resolvedAt: null,
  resolverVersion: null,
}

export const EMPTY_SIGNATURE_SNAPSHOT: IntakeSignatureSnapshot = {
  signed: false,
  signedByName: null,
  signedAt: null,
  signatureDataUrl: null,
  signerIp: null,
  signerUserAgent: null,
  invalidatedAt: null,
  invalidationReason: null,
}

export const EMPTY_VALIDATION_SNAPSHOT: IntakeValidationSnapshot = {
  isValidForSubmit: false,
  missingFields: [],
  blockingIssues: [],
  warnings: [],
  validatedAt: null,
}
