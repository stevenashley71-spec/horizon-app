'use server'

import { getUserRole } from '@/lib/auth/get-user-role'
import { createServiceRoleSupabase } from '@/lib/supabase/server'

type ClinicPinRow = {
  exit_pin: string | null
}

export async function validateClinicPinInternal(
  clinicId: string,
  pin: string
): Promise<boolean> {
  const userRole = await getUserRole()

  if (!userRole || (userRole.role !== 'admin' && userRole.role !== 'horizon_staff')) {
    return false
  }

  const normalizedClinicId = clinicId.trim()
  const normalizedPin = pin.trim()

  if (!normalizedClinicId || !normalizedPin) {
    return false
  }

  const supabase = createServiceRoleSupabase()
  const { data: clinicPinData, error: clinicPinError } = await supabase
    .from('clinics')
    .select('exit_pin')
    .eq('id', normalizedClinicId)
    .single()

  if (clinicPinError || !clinicPinData) {
    return false
  }

  const expectedPin = ((clinicPinData as ClinicPinRow).exit_pin ?? '').trim()

  if (!expectedPin) {
    return false
  }

  return normalizedPin === expectedPin
}
