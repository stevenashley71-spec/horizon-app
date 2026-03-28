'use server'

import { revalidatePath } from 'next/cache'

import { requireTemporaryHorizonAdmin } from '@/lib/admin-auth'
import { createServiceRoleSupabase } from '@/lib/supabase/server'

export async function createClinicUserAdmin(formData: FormData) {
  await requireTemporaryHorizonAdmin()

  const supabase = createServiceRoleSupabase()
  const clinicId = String(formData.get('clinic_id') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')

  if (!clinicId) {
    throw new Error('Clinic is required')
  }

  if (!email) {
    throw new Error('Email / username is required')
  }

  if (password.length < 6) {
    throw new Error('Password must be at least 6 characters')
  }

  const { data: clinic, error: clinicError } = await supabase
    .from('clinics')
    .select('id, name')
    .eq('id', clinicId)
    .single()

  if (clinicError || !clinic) {
    throw new Error('Clinic not found')
  }

  const { data: createdUser, error: createUserError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (createUserError || !createdUser.user) {
    throw new Error(createUserError?.message || 'Failed to create clinic auth user')
  }

  const { error: clinicUserError } = await supabase
    .from('clinic_users')
    .insert({
      user_id: createdUser.user.id,
      clinic_id: clinic.id,
    })

  if (clinicUserError) {
    await supabase.auth.admin.deleteUser(createdUser.user.id)
    throw new Error(clinicUserError.message)
  }

  revalidatePath('/admin/clinic-users')

  return {
    success: true,
    email,
    clinicName: clinic.name,
  }
}
