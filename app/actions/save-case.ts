'use server'

import { getUserRole } from '@/lib/auth/get-user-role'
import { getClinicContextResult } from '@/lib/clinic-auth'
import { createServiceRoleSupabase } from '@/lib/supabase/server'

export type SaveCasePayload = {
  clinic_name?: string
  pet_name: string
  pet_species?: string
  pet_weight?: number | string
  pet_weight_unit?: string
  pet_weight_lbs?: number
  pet_breed?: string
  pet_color?: string
  owner_name: string
  owner_phone?: string
  owner_email?: string
  owner_address?: string
  owner_city?: string
  owner_state?: string
  owner_zip?: string
}

export async function saveCase(payload: SaveCasePayload) {
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

  const supabase = createServiceRoleSupabase()

  const {
    case_number: _ignoredCaseNumber,
    ...restPayload
  } = payload as SaveCasePayload & { case_number?: string }
  const { data, error } = await supabase.rpc('create_case_with_initial_event', {
    clinic_id: clinicResult.clinic.clinicId,
    clinic_name: clinicResult.clinic.clinicName,
    created_by: clinicResult.clinic.userId,
    pet_name: restPayload.pet_name,
    pet_species: restPayload.pet_species ?? null,
    pet_weight:
      restPayload.pet_weight === undefined || restPayload.pet_weight === null
        ? null
        : String(restPayload.pet_weight),
    pet_weight_unit: restPayload.pet_weight_unit ?? null,
    pet_weight_lbs: restPayload.pet_weight_lbs ?? null,
    pet_breed: restPayload.pet_breed ?? null,
    pet_color: restPayload.pet_color ?? null,
    owner_name: restPayload.owner_name,
    owner_phone: restPayload.owner_phone ?? null,
    owner_email: restPayload.owner_email ?? null,
    owner_address: restPayload.owner_address ?? null,
    owner_city: restPayload.owner_city ?? null,
    owner_state: restPayload.owner_state ?? null,
    owner_zip: restPayload.owner_zip ?? null,
  })

  if (error) {
    console.error('Error creating case via RPC:', error)
    throw new Error('Unable to create case')
  }

  const createdCase = Array.isArray(data) ? data[0] : data

  console.log('Case inserted with ID:', createdCase?.id, 'Case Number:', createdCase?.case_number)

  return { id: createdCase?.id, caseNumber: createdCase?.case_number }
}
