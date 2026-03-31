'use server'

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
import type { IntakeDraftStatus, IntakeSource } from '@/lib/intake/types'
import { createServiceRoleSupabase } from '@/lib/supabase/server'

type IntakeDraftInsertRow = {
  id: string
  status: IntakeDraftStatus
  intake_source: IntakeSource
  created_at: string
  updated_at: string
}

export type CreateIntakeDraftResult = {
  id: string
  status: 'draft'
  source: 'clinic_staff' | 'client_mode'
  createdAt: string
  updatedAt: string
}

export async function createIntakeDraft(
  source: 'clinic_staff' | 'client_mode' = 'clinic_staff'
): Promise<CreateIntakeDraftResult> {
  const userRole = await getUserRole()
  const clinicResult = await getClinicContextResult()

  if (!userRole || !clinicResult || clinicResult.kind !== 'ok') {
    throw new Error('Authentication required')
  }

  const supabase = createServiceRoleSupabase()

  const { data, error } = await supabase
    .from('intake_drafts')
    .insert({
      clinic_id: clinicResult.clinic.clinicId,
      created_by_user_id: clinicResult.clinic.userId,
      last_updated_by_user_id: clinicResult.clinic.userId,
      status: 'draft',
      intake_source: source,
      locked_for_client_mode: false,
      pet_snapshot: EMPTY_PET_SNAPSHOT,
      owner_snapshot: EMPTY_OWNER_SNAPSHOT,
      service_snapshot: EMPTY_SERVICE_SNAPSHOT,
      product_snapshot: EMPTY_PRODUCT_SNAPSHOT,
      pricing_snapshot: EMPTY_PRICING_SNAPSHOT,
      signature_snapshot: EMPTY_SIGNATURE_SNAPSHOT,
      validation_snapshot: EMPTY_VALIDATION_SNAPSHOT,
    })
    .select('id, status, intake_source, created_at, updated_at')
    .single()

  if (error || !data) {
    throw new Error('Unable to create intake draft')
  }

  const draft = data as IntakeDraftInsertRow

  return {
    id: draft.id,
    status: 'draft',
    source: draft.intake_source,
    createdAt: draft.created_at,
    updatedAt: draft.updated_at,
  }
}
