'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabase } from '@/lib/supabase/server'
import type { SaveCasePayload } from './save-case'

export type UpdateCasePayload = SaveCasePayload & {
  id: string
  status?: string
  case_number?: string
}

export async function updateCase(payload: UpdateCasePayload) {
  const { id, case_number: _ignoredCaseNumber, case_data, status: _ignoredStatus, ...updates } = payload

  const supabase = createServerSupabase()

  const { data: existingCase, error: existingCaseError } = await supabase
    .from('cases')
    .select('id, case_number, case_data, status, clinic_name, pet_name, pet_species, pet_weight, pet_weight_unit, pet_weight_lbs, pet_breed, pet_color, owner_name, owner_phone, owner_email, owner_address, owner_city, owner_state, owner_zip, cremation_type, selected_urn, additional_urns, soulburst_items, memorial_items, subtotal, total')
    .eq('id', id)
    .single()

  if (existingCaseError || !existingCase) {
    throw new Error(existingCaseError?.message || 'Case not found')
  }

  const preservedCaseNumber = existingCase.case_number

  const updatePayload = {
    clinic_name: updates.clinic_name !== undefined ? updates.clinic_name ?? null : existingCase.clinic_name,
    pet_name: updates.pet_name !== undefined ? updates.pet_name : existingCase.pet_name,
    pet_species: updates.pet_species !== undefined ? updates.pet_species ?? null : existingCase.pet_species,
    pet_weight: updates.pet_weight !== undefined ? updates.pet_weight ?? null : existingCase.pet_weight,
    pet_weight_unit: updates.pet_weight_unit !== undefined ? updates.pet_weight_unit ?? null : existingCase.pet_weight_unit,
    pet_weight_lbs: updates.pet_weight_lbs !== undefined ? updates.pet_weight_lbs ?? null : existingCase.pet_weight_lbs,
    pet_breed: updates.pet_breed !== undefined ? updates.pet_breed ?? null : existingCase.pet_breed,
    pet_color: updates.pet_color !== undefined ? updates.pet_color ?? null : existingCase.pet_color,
    owner_name: updates.owner_name !== undefined ? updates.owner_name : existingCase.owner_name,
    owner_phone: updates.owner_phone !== undefined ? updates.owner_phone ?? null : existingCase.owner_phone,
    owner_email: updates.owner_email !== undefined ? updates.owner_email ?? null : existingCase.owner_email,
    owner_address: updates.owner_address !== undefined ? updates.owner_address ?? null : existingCase.owner_address,
    owner_city: updates.owner_city !== undefined ? updates.owner_city ?? null : existingCase.owner_city,
    owner_state: updates.owner_state !== undefined ? updates.owner_state ?? null : existingCase.owner_state,
    owner_zip: updates.owner_zip !== undefined ? updates.owner_zip ?? null : existingCase.owner_zip,
    cremation_type: updates.cremation_type !== undefined ? updates.cremation_type ?? null : existingCase.cremation_type,
    selected_urn: updates.selected_urn !== undefined ? updates.selected_urn ?? null : existingCase.selected_urn,
    additional_urns: updates.additional_urns !== undefined ? updates.additional_urns ?? [] : existingCase.additional_urns,
    soulburst_items: updates.soulburst_items !== undefined ? updates.soulburst_items ?? [] : existingCase.soulburst_items,
    memorial_items: updates.memorial_items !== undefined ? updates.memorial_items ?? [] : existingCase.memorial_items,
    subtotal: updates.subtotal !== undefined ? updates.subtotal ?? null : existingCase.subtotal,
    total: updates.total !== undefined ? updates.total ?? null : existingCase.total,
    case_number: preservedCaseNumber,
    case_data: {
      ...((existingCase.case_data as Record<string, unknown> | null) ?? {}),
      ...((case_data as Record<string, unknown> | null) ?? {}),
      case_number: preservedCaseNumber,
    },
  }

  const { data, error } = await supabase
    .from('cases')
    .update(updatePayload)
    .eq('id', id)
    .select('id, case_number')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/cases')
  revalidatePath(`/cases/${id}`)

  return { id: data.id, caseNumber: data.case_number }
}
