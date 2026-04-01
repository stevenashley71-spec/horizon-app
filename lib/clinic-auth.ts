import { getUserRole } from '@/lib/auth/get-user-role'
import { createServerAuthSupabase, createServerSupabase } from '@/lib/supabase/server'

export type ClinicContext = {
  userId: string
  clinicId: string
  clinicName: string
  clinicLogoPath: string | null
}

type ClinicContextResult =
  | {
      kind: 'ok'
      clinic: ClinicContext
    }
  | {
      kind: 'blocked'
      message: string
    }

export async function getClinicContextResult(): Promise<ClinicContextResult | null> {
  const userRole = await getUserRole()

  if (userRole?.role === 'clinic_user') {
    const supabase = await createServerSupabase()
    const { data: clinic, error: clinicError } = await supabase
      .from('clinics')
      .select('id, name, logo_path, is_active')
      .eq('id', userRole.clinicId)
      .single()

    if (clinicError || !clinic || !clinic.is_active) {
      return {
        kind: 'blocked',
        message: 'Your clinic account is inactive.',
      }
    }

    return {
      kind: 'ok',
      clinic: {
        userId: userRole.userId,
        clinicId: clinic.id,
        clinicName: clinic.name,
        clinicLogoPath: clinic.logo_path,
      },
    }
  }

  const authSupabase = await createServerAuthSupabase()
  const {
    data: { user },
  } = await authSupabase.auth.getUser()

  if (!user) {
    return null
  }

  return {
    kind: 'blocked',
    message: 'Your account is not linked to a clinic.',
  }
}
