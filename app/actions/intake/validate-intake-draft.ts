'use server'

import { getUserRole } from '@/lib/auth/get-user-role'
import { getClinicContextResult } from '@/lib/clinic-auth'
import type {
  IntakeOwnerSnapshot,
  IntakePetSnapshot,
  IntakeServiceSnapshot,
  IntakeValidationSnapshot,
} from '@/lib/intake/types'
import { createServiceRoleSupabase } from '@/lib/supabase/server'

type IntakeDraftValidationRow = {
  id: string
  pet_snapshot: IntakePetSnapshot | null
  owner_snapshot: IntakeOwnerSnapshot | null
  service_snapshot: IntakeServiceSnapshot | null
}

export async function validateIntakeDraft(draftId: string): Promise<IntakeValidationSnapshot> {
  const userRole = await getUserRole()
  const clinicResult = await getClinicContextResult()

  if (!userRole || !clinicResult || clinicResult.kind !== 'ok') {
    throw new Error('Authentication required')
  }

  const supabase = createServiceRoleSupabase()

  const { data, error } = await supabase
    .from('intake_drafts')
    .select('id, pet_snapshot, owner_snapshot, service_snapshot')
    .eq('id', draftId)
    .eq('clinic_id', clinicResult.clinic.clinicId)
    .single()

  if (error || !data) {
    throw new Error('Draft not found')
  }

  const draft = data as IntakeDraftValidationRow
  const pet = draft.pet_snapshot
  const owner = draft.owner_snapshot
  const service = draft.service_snapshot

  const missingFields: string[] = []

  if (!pet?.petName?.trim()) {
    missingFields.push('petName')
  }

  if (!owner?.ownerName?.trim()) {
    missingFields.push('ownerName')
  }

  const hasOwnerPhone = Boolean(owner?.phone?.trim())
  const hasOwnerEmail = Boolean(owner?.email?.trim())

  if (!hasOwnerPhone && !hasOwnerEmail) {
    missingFields.push('ownerContact')
  }

  if (!service?.cremationType) {
    missingFields.push('cremationType')
  }

  const validation: IntakeValidationSnapshot = {
    isValidForSubmit: missingFields.length === 0,
    missingFields,
    blockingIssues: [],
    warnings: [],
    validatedAt: new Date().toISOString(),
  }

  const { error: updateError } = await supabase
    .from('intake_drafts')
    .update({
      validation_snapshot: validation,
      last_updated_by_user_id: userRole.userId,
    })
    .eq('id', draftId)
    .eq('clinic_id', clinicResult.clinic.clinicId)

  if (updateError) {
    throw new Error('Unable to validate draft')
  }

  return validation
}
