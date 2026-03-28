'use server'

import { getClinicContextResult } from '@/lib/clinic-auth'
import { CASE_EVENT_TYPES } from '@/lib/case-events'
import { createServerSupabase } from '@/lib/supabase/server'

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
  cremation_type?: string
  selected_urn?: string
  additional_urns?: Array<{ urn_id: number | string; urn_name: string; qty: number }>
  soulburst_items?: Array<{ item_id: number | string; item_name: string; qty: number }>
  memorial_items?: Array<{ item_id: string; item_name: string; qty: number }>
  subtotal?: number
  total?: number
  case_data?: any
}

export async function saveCase(payload: SaveCasePayload) {
  const clinicResult = await getClinicContextResult()

  if (!clinicResult) {
    throw new Error('Authentication required')
  }

  if (clinicResult.kind === 'blocked') {
    throw new Error(clinicResult.message)
  }

  const supabase = createServerSupabase()

  // Generate case number
  const { data: caseNumber, error: genError } = await supabase.rpc('generate_case_number')
  if (genError) {
    console.error('Error generating case number:', genError)
    throw new Error('Failed to generate case number: ' + genError.message)
  }
  console.log('Generated case number:', caseNumber)

  const {
    case_number: _ignoredCaseNumber,
    case_data,
    ...restPayload
  } = payload as SaveCasePayload & { case_number?: string }

  const insertPayload = {
    clinic_id: clinicResult.clinic.clinicId,
    clinic_name: clinicResult.clinic.clinicName,
    pet_name: restPayload.pet_name,
    pet_species: restPayload.pet_species ?? null,
    pet_weight: restPayload.pet_weight ?? null,
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
    cremation_type: restPayload.cremation_type ?? null,
    selected_urn: restPayload.selected_urn ?? null,
    additional_urns: restPayload.additional_urns ?? [],
    soulburst_items: restPayload.soulburst_items ?? [],
    memorial_items: restPayload.memorial_items ?? [],
    subtotal: restPayload.subtotal ?? null,
    total: restPayload.total ?? null,
    case_data: {
      ...(case_data ?? {}),
      clinicId: clinicResult.clinic.clinicId,
      clinicName: clinicResult.clinic.clinicName,
      case_number: caseNumber,
    },
    case_number: caseNumber,
  }

  const { data, error } = await supabase
    .from('cases')
    .insert(insertPayload)
    .select('id, case_number')
    .single()

  if (error) {
    console.error('Error inserting case:', error, 'Payload:', insertPayload)
    throw new Error(error.message)
  }

  const { error: caseEventError } = await supabase.from('case_events').insert({
    case_id: data.id,
    case_number: data.case_number,
    event_type: CASE_EVENT_TYPES.CASE_CREATED,
    created_by: clinicResult.clinic.userId,
  })

  if (caseEventError) {
    console.error('Error inserting initial case event:', caseEventError, 'Case ID:', data?.id)
    throw new Error(caseEventError.message)
  }

  console.log('Case inserted with ID:', data?.id, 'Case Number:', data?.case_number)

  return { id: data?.id, caseNumber: data?.case_number }
}
