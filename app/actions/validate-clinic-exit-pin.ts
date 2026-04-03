'use server'

import { getUserRole } from '@/lib/auth/get-user-role'
import { getClinicContextResult } from '@/lib/clinic-auth'
import { createServiceRoleSupabase } from '@/lib/supabase/server'

type ClinicPinRow = {
  exit_pin: string | null
}

export async function validateClinicExitPin(pin: string): Promise<boolean> {
  const userRole = await getUserRole()
  const clinicResult = await getClinicContextResult()

  if (!userRole || !clinicResult || clinicResult.kind !== 'ok') {
    return false
  }

  if (userRole.role !== 'clinic_user') {
    return false
  }

  const supabase = createServiceRoleSupabase()
  const { data: clinicPinData, error: clinicPinError } = await supabase
    .from('clinics')
    .select('exit_pin')
    .eq('id', clinicResult.clinic.clinicId)
    .single()

  if (clinicPinError || !clinicPinData) {
    return false
  }

  const expectedPin = (clinicPinData as ClinicPinRow).exit_pin

  if (!expectedPin) {
    return true
  }

  return pin === expectedPin
}
