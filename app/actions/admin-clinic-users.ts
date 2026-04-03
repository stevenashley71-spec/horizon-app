'use server'

import { revalidatePath } from 'next/cache'

import { requireTemporaryHorizonAdmin } from '@/lib/admin-auth'
import { createServiceRoleSupabase } from '@/lib/supabase/server'

export async function updateClinicUserPasswordAdmin(
  formData: FormData
): Promise<{ success: true }> {
  await requireTemporaryHorizonAdmin()

  const supabase = createServiceRoleSupabase()
  const userId = String(formData.get('user_id') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  if (!userId) {
    throw new Error('User is required')
  }

  if (!password) {
    throw new Error('Password is required')
  }

  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters')
  }

  const { error } = await supabase.auth.admin.updateUserById(userId, {
    password,
  })

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/admin/clinic-users')
  revalidatePath('/admin/clinics')

  return { success: true }
}
