import {
  createServerAuthSupabase,
  createServerSupabase,
  createServiceRoleSupabase,
} from '@/lib/supabase/server'

export type UserRole = 'admin' | 'horizon_staff' | 'clinic_user'

export type GetUserRoleResult =
  | null
  | {
      userId: string
      email: string | null
      role: 'admin' | 'horizon_staff'
      clinicId: null
      clinicName: null
    }
  | {
      userId: string
      email: string | null
      role: 'clinic_user'
      clinicId: string
      clinicName: string
    }

type ClinicUserRow = {
  clinic_id: string
  is_active: boolean
}

type HorizonUserRow = {
  role: 'admin' | 'horizon_staff'
  is_active: boolean
}

type ClinicRow = {
  id: string
  name: string
  is_active: boolean
}

export async function getUserRole(): Promise<GetUserRoleResult> {
  const authSupabase = await createServerAuthSupabase()
  const {
    data: { user },
  } = await authSupabase.auth.getUser()

  if (!user) {
    return null
  }

  const userId = user.id
  const email = user.email ?? null
  const supabase = await createServerSupabase()
  const serviceRoleSupabase = createServiceRoleSupabase()

  const { data: horizonUser, error: horizonUserError } = await serviceRoleSupabase
    .from('horizon_users')
    .select('role, is_active')
    .eq('user_id', userId)
    .single()

  if (!horizonUserError && horizonUser && (horizonUser as HorizonUserRow).is_active) {
    const typedHorizonUser = horizonUser as HorizonUserRow

    return {
      userId,
      email,
      role: typedHorizonUser.role,
      clinicId: null,
      clinicName: null,
    }
  }

  const normalizedEmail = email?.trim().toLowerCase() ?? ''
  const adminEmail = (process.env.HORIZON_ADMIN_EMAIL ?? '').trim().toLowerCase()

  // Current transition fallback until all internal Horizon users are stored in horizon_users.
  if (adminEmail && normalizedEmail === adminEmail) {
    return {
      userId,
      email,
      role: 'admin',
      clinicId: null,
      clinicName: null,
    }
  }

  const { data: clinicUser, error: clinicUserError } = await supabase
    .from('clinic_users')
    .select('clinic_id, is_active')
    .eq('user_id', userId)
    .single()

  if (clinicUserError || !clinicUser || !(clinicUser as ClinicUserRow).is_active) {
    return null
  }

  const typedClinicUser = clinicUser as ClinicUserRow

  const { data: clinic, error: clinicError } = await supabase
    .from('clinics')
    .select('id, name, is_active')
    .eq('id', typedClinicUser.clinic_id)
    .single()

  if (clinicError || !clinic || !(clinic as ClinicRow).is_active) {
    return null
  }

  const typedClinic = clinic as ClinicRow

  return {
    userId,
    email,
    role: 'clinic_user',
    clinicId: typedClinic.id,
    clinicName: typedClinic.name,
  }
}
