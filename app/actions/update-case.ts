'use server'

import { revalidatePath } from 'next/cache'
import { getUserRole } from '@/lib/auth/get-user-role'
import { getClinicContextResult } from '@/lib/clinic-auth'
import { createServiceRoleSupabase } from '@/lib/supabase/server'
import type { SaveCasePayload } from './save-case'

export type UpdateCasePayload = SaveCasePayload & {
  id: string
  status?: string
  case_number?: string
}

export async function updateCase(payload: UpdateCasePayload) {
  const userRole = await getUserRole()
  const clinicResult = await getClinicContextResult()

  if (!clinicResult) {
    throw new Error('Authentication required')
  }

  if (clinicResult.kind === 'blocked') {
    throw new Error(clinicResult.message)
  }

  if (!userRole || userRole.role !== 'clinic_user') {
    throw new Error('Clinic user access is required')
  }

  const { id, case_number: _ignoredCaseNumber, status: _ignoredStatus, ...updates } = payload

  const serviceRoleSupabase = createServiceRoleSupabase()

  const { data: existingCase, error: existingCaseError } = await serviceRoleSupabase
    .from('cases')
    .select('id, clinic_id, case_number, case_data, status, clinic_name, pet_name, pet_species, pet_weight, pet_weight_unit, pet_weight_lbs, pet_breed, pet_color, owner_name, owner_phone, owner_email, owner_address, owner_city, owner_state, owner_zip, cremation_type, selected_urn, additional_urns, soulburst_items, memorial_items, subtotal, total')
    .eq('id', id)
    .single()

  if (!existingCase) {
    throw new Error('Case not found')
  }

  if (existingCaseError) {
    throw new Error('Unable to load case')
  }

  if (existingCase.clinic_id !== clinicResult.clinic.clinicId) {
    throw new Error('You do not have permission to update this case')
  }

  const preservedCaseNumber = existingCase.case_number

  const { data, error } = await serviceRoleSupabase.rpc('update_case_with_history', {
    target_case_id: id,
    expected_clinic_id: clinicResult.clinic.clinicId,
    changed_by: clinicResult.clinic.userId,
    next_pet_name: updates.pet_name !== undefined ? updates.pet_name : existingCase.pet_name,
    next_pet_species:
      updates.pet_species !== undefined ? updates.pet_species ?? null : existingCase.pet_species,
    next_pet_weight:
      updates.pet_weight !== undefined
        ? updates.pet_weight === null
          ? null
          : String(updates.pet_weight)
        : existingCase.pet_weight,
    next_pet_weight_unit:
      updates.pet_weight_unit !== undefined
        ? updates.pet_weight_unit ?? null
        : existingCase.pet_weight_unit,
    next_pet_weight_lbs:
      updates.pet_weight_lbs !== undefined
        ? updates.pet_weight_lbs ?? null
        : existingCase.pet_weight_lbs,
    next_pet_breed:
      updates.pet_breed !== undefined ? updates.pet_breed ?? null : existingCase.pet_breed,
    next_pet_color:
      updates.pet_color !== undefined ? updates.pet_color ?? null : existingCase.pet_color,
    next_owner_name:
      updates.owner_name !== undefined ? updates.owner_name : existingCase.owner_name,
    next_owner_phone:
      updates.owner_phone !== undefined ? updates.owner_phone ?? null : existingCase.owner_phone,
    next_owner_email:
      updates.owner_email !== undefined ? updates.owner_email ?? null : existingCase.owner_email,
    next_owner_address:
      updates.owner_address !== undefined
        ? updates.owner_address ?? null
        : existingCase.owner_address,
    next_owner_city:
      updates.owner_city !== undefined ? updates.owner_city ?? null : existingCase.owner_city,
    next_owner_state:
      updates.owner_state !== undefined ? updates.owner_state ?? null : existingCase.owner_state,
    next_owner_zip:
      updates.owner_zip !== undefined ? updates.owner_zip ?? null : existingCase.owner_zip,
  })

  if (error) {
    throw new Error('Unable to update case')
  }

  const updatedCase = Array.isArray(data) ? data[0] : data

  revalidatePath('/cases')
  revalidatePath(`/cases/${id}`)

  return { id: updatedCase.id, caseNumber: updatedCase.case_number ?? preservedCaseNumber }
}
