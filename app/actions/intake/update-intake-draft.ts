'use server'

import { getUserRole } from '@/lib/auth/get-user-role'
import { getClinicContextResult } from '@/lib/clinic-auth'
import type {
  IntakeDraftStatus,
  IntakeOwnerSnapshot,
  IntakePetSnapshot,
  IntakeProductSnapshot,
  IntakeServiceSnapshot,
} from '@/lib/intake/types'
import { createServiceRoleSupabase } from '@/lib/supabase/server'

export type UpdateIntakeDraftInput =
  | { draftId: string; section: 'pet'; data: IntakePetSnapshot }
  | { draftId: string; section: 'owner'; data: IntakeOwnerSnapshot }
  | { draftId: string; section: 'service'; data: IntakeServiceSnapshot }
  | { draftId: string; section: 'products'; data: IntakeProductSnapshot }

export type UpdateIntakeDraftResult = {
  id: string
  updatedAt: string
}

type IntakeDraftLookupRow = {
  id: string
  status: IntakeDraftStatus
}

type IntakeDraftUpdateRow = {
  id: string
  updated_at: string
}

export async function updateIntakeDraft(
  input: UpdateIntakeDraftInput
): Promise<UpdateIntakeDraftResult> {
  const userRole = await getUserRole()
  const clinicResult = await getClinicContextResult()

  if (!userRole || !clinicResult || clinicResult.kind !== 'ok') {
    throw new Error('Authentication required')
  }

  const supabase = createServiceRoleSupabase()

  const { data: draft, error: draftError } = await supabase
    .from('intake_drafts')
    .select('id, status')
    .eq('id', input.draftId)
    .eq('clinic_id', clinicResult.clinic.clinicId)
    .single()

  if (draftError || !draft) {
    throw new Error('Draft not found')
  }

  const typedDraft = draft as IntakeDraftLookupRow

  if (typedDraft.status === 'submitted') {
    throw new Error('Draft is locked')
  }

  const sectionUpdate =
    input.section === 'pet'
      ? { pet_snapshot: input.data }
      : input.section === 'owner'
        ? { owner_snapshot: input.data }
        : input.section === 'service'
          ? { service_snapshot: input.data }
          : { product_snapshot: input.data }

  const { data, error } = await supabase
    .from('intake_drafts')
    .update({
      ...sectionUpdate,
      last_updated_by_user_id: userRole.userId,
    })
    .eq('id', input.draftId)
    .eq('clinic_id', clinicResult.clinic.clinicId)
    .select('id, updated_at')
    .single()

  if (error || !data) {
    throw new Error('Unable to update draft')
  }

  const updatedDraft = data as IntakeDraftUpdateRow

  return {
    id: updatedDraft.id,
    updatedAt: updatedDraft.updated_at,
  }
}
