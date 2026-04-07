'use server'

import { loadClinicIntakeCatalog } from '@/app/actions/intake/load-clinic-intake-catalog'
import { getUserRole } from '@/lib/auth/get-user-role'
import { getClinicContextResult } from '@/lib/clinic-auth'
import {
  EMPTY_OWNER_SNAPSHOT,
  EMPTY_PET_SNAPSHOT,
  EMPTY_PRICING_SNAPSHOT,
  EMPTY_PRODUCT_SNAPSHOT,
  EMPTY_SERVICE_SNAPSHOT,
  EMPTY_SIGNATURE_SNAPSHOT,
  EMPTY_VALIDATION_SNAPSHOT,
} from '@/lib/intake/defaults'
import type {
  ClinicIntakeCatalog,
  IntakeDraftStatus,
  IntakeOwnerSnapshot,
  IntakePetSnapshot,
  IntakePricingSnapshot,
  IntakeProductSnapshot,
  IntakeServiceSnapshot,
  IntakeSignatureSnapshot,
  IntakeSource,
  IntakeValidationSnapshot,
} from '@/lib/intake/types'
import { createServiceRoleSupabase } from '@/lib/supabase/server'

type IntakeDraftRow = {
  id: string
  status: IntakeDraftStatus
  intake_source: IntakeSource
  pet_snapshot: IntakePetSnapshot | null
  owner_snapshot: IntakeOwnerSnapshot | null
  service_snapshot: IntakeServiceSnapshot | null
  product_snapshot: IntakeProductSnapshot | null
  pricing_snapshot: IntakePricingSnapshot | null
  signature_snapshot: IntakeSignatureSnapshot | null
  validation_snapshot: IntakeValidationSnapshot | null
  created_at: string | null
  updated_at: string | null
}

export type LoadedIntakeDraft = {
  id: string | null
  status: IntakeDraftStatus
  source: IntakeSource
  pet: IntakePetSnapshot
  owner: IntakeOwnerSnapshot
  service: IntakeServiceSnapshot
  products: IntakeProductSnapshot
  pricing: IntakePricingSnapshot
  signature: IntakeSignatureSnapshot
  validation: IntakeValidationSnapshot
  createdAt: string | null
  updatedAt: string | null
}

type LoadedIntakeDraftWithCatalog = LoadedIntakeDraft & {
  catalog: ClinicIntakeCatalog
}

export type LoadIntakeDraftOptions = {
  clinicContextOverride?: {
    clinicId: string
  }
}

export async function loadIntakeDraft(
  draftId?: string,
  options?: LoadIntakeDraftOptions
): Promise<LoadedIntakeDraftWithCatalog> {
  const clinicContextOverride = options?.clinicContextOverride
  const allowFreshOverrideWithoutAuth = Boolean(clinicContextOverride && !draftId)
  const userRole = allowFreshOverrideWithoutAuth ? null : await getUserRole()
  const clinicResult = allowFreshOverrideWithoutAuth ? null : await getClinicContextResult()

  if (!allowFreshOverrideWithoutAuth && (!userRole || !clinicResult || clinicResult.kind !== 'ok')) {
    throw new Error('Authentication required')
  }

  const clinicIdForDraft =
    clinicContextOverride?.clinicId?.trim() ||
    (clinicResult && clinicResult.kind === 'ok' ? clinicResult.clinic.clinicId : null)

  let catalog: ClinicIntakeCatalog

  try {
    catalog = await loadClinicIntakeCatalog({
      clinicContextOverride,
    })
  } catch (error) {
    if (
      process.env.NODE_ENV !== 'production' &&
      error instanceof Error &&
      (error.message === 'Failed to load clinic' || error.message === 'Clinic not found')
    ) {
      catalog = {
        clinic: {
          id: 'dev-clinic-1',
          name: 'Development Clinic',
          code: null,
          logoUrl: null,
          logoAlt: null,
        },
        services: [],
        memorialItems: [],
        premiumUrns: [],
        soulBursts: [],
        addOns: [],
        pricing: {
          profile: {
            scope: 'clinic',
            sourceClinicId: null,
            sourceClinicCode: null,
          },
          cremationPricing: [],
          productPricing: [],
          resolvedAt: new Date(0).toISOString(),
          resolverVersion: 'fallback-dev',
        },
      }
    } else {
      throw error
    }
  }

  if (!draftId) {
    return {
      id: null,
      status: 'draft',
      source: 'clinic_staff',
      pet: EMPTY_PET_SNAPSHOT,
      owner: EMPTY_OWNER_SNAPSHOT,
      service: EMPTY_SERVICE_SNAPSHOT,
      products: EMPTY_PRODUCT_SNAPSHOT,
      pricing: EMPTY_PRICING_SNAPSHOT,
      signature: EMPTY_SIGNATURE_SNAPSHOT,
      validation: EMPTY_VALIDATION_SNAPSHOT,
      createdAt: null,
      updatedAt: null,
      catalog,
    }
  }

  const supabase = createServiceRoleSupabase()

  const { data, error } = await supabase
    .from('intake_drafts')
    .select(
      'id, status, intake_source, pet_snapshot, owner_snapshot, service_snapshot, product_snapshot, pricing_snapshot, signature_snapshot, validation_snapshot, created_at, updated_at'
    )
    .eq('id', draftId)
    .eq('clinic_id', clinicIdForDraft)
    .single()

  if (error || !data) {
    throw new Error('Draft not found')
  }

  const draft = data as IntakeDraftRow

  return {
    id: draft.id,
    status: draft.status,
    source: draft.intake_source,
    pet: draft.pet_snapshot ?? EMPTY_PET_SNAPSHOT,
    owner: draft.owner_snapshot ?? EMPTY_OWNER_SNAPSHOT,
    service: draft.service_snapshot ?? EMPTY_SERVICE_SNAPSHOT,
    products: draft.product_snapshot ?? EMPTY_PRODUCT_SNAPSHOT,
    pricing: draft.pricing_snapshot ?? EMPTY_PRICING_SNAPSHOT,
    signature: draft.signature_snapshot ?? EMPTY_SIGNATURE_SNAPSHOT,
    validation: draft.validation_snapshot ?? EMPTY_VALIDATION_SNAPSHOT,
    createdAt: draft.created_at,
    updatedAt: draft.updated_at,
    catalog,
  }
}
