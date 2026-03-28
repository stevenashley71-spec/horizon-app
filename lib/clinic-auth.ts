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

async function getAuthenticatedUserId() {
  const supabase = await createServerAuthSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return user?.id ?? null
}

export async function getClinicContextResult(): Promise<ClinicContextResult | null> {
  const userId = await getAuthenticatedUserId()

  if (!userId) {
    return null
  }

  const supabase = createServerSupabase()
  const { data: clinicUser, error: clinicUserError } = await supabase
    .from('clinic_users')
    .select('clinic_id')
    .eq('user_id', userId)
    .single()

  if (clinicUserError || !clinicUser) {
    return {
      kind: 'blocked',
      message: 'Your account is not linked to a clinic.',
    }
  }

  const { data: clinic, error: clinicError } = await supabase
    .from('clinics')
    .select('id, name, logo_path, is_active')
    .eq('id', clinicUser.clinic_id)
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
      userId,
      clinicId: clinic.id,
      clinicName: clinic.name,
      clinicLogoPath: clinic.logo_path,
    },
  }
}
