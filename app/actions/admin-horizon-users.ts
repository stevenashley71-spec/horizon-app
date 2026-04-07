'use server'

import { revalidatePath } from 'next/cache'

import { requireTemporaryHorizonAdmin } from '@/lib/admin-auth'
import { createServiceRoleSupabase } from '@/lib/supabase/server'

export async function createHorizonStaffAdmin(
  formData: FormData
): Promise<void> {
  await requireTemporaryHorizonAdmin()

  const supabase = createServiceRoleSupabase()
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')

  if (!email) {
    throw new Error('Email is required')
  }

  if (!password) {
    throw new Error('Password is required')
  }

  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters')
  }

  const { data: createdUser, error: createUserError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (createUserError || !createdUser.user) {
    throw new Error(createUserError?.message || 'Failed to create Horizon Staff user')
  }

  const createdAuthUserId = createdUser.user.id

  const { error: horizonUserError } = await supabase
    .from('horizon_users')
    .insert({
      user_id: createdAuthUserId,
      role: 'horizon_staff',
      is_active: true,
    })

  if (horizonUserError) {
    await supabase.auth.admin.deleteUser(createdAuthUserId)
    throw new Error(horizonUserError.message)
  }

  revalidatePath('/admin/staff')
}

export async function deleteHorizonStaffAdmin(
  formData: FormData
): Promise<void> {
  await requireTemporaryHorizonAdmin()

  const supabase = createServiceRoleSupabase()
  const userId = String(formData.get('user_id') ?? '').trim()

  if (!userId) {
    throw new Error('User is required')
  }

  const { data: horizonUser, error: horizonUserError } = await supabase
    .from('horizon_users')
    .select('user_id, role')
    .eq('user_id', userId)
    .maybeSingle()

  if (horizonUserError) {
    throw new Error(horizonUserError.message)
  }

  if (!horizonUser || horizonUser.role !== 'horizon_staff') {
    throw new Error('Only Horizon Staff users can be deleted.')
  }

  const { error: deleteUserError } = await supabase.auth.admin.deleteUser(userId)

  if (deleteUserError) {
    throw new Error(deleteUserError.message)
  }

  revalidatePath('/admin/staff')
}

export async function saveHorizonNotificationSettingsAdmin(
  formData: FormData
): Promise<void> {
  await requireTemporaryHorizonAdmin()

  const supabase = createServiceRoleSupabase()
  const notificationEmail = String(formData.get('notification_email') ?? '').trim() || null
  const notificationPhone = String(formData.get('notification_phone') ?? '').trim() || null
  const notificationSmsPhone =
    String(formData.get('notification_sms_phone') ?? '').trim() || null

  const { error } = await supabase.from('horizon_settings').upsert({
    id: true,
    notification_email: notificationEmail,
    notification_phone: notificationPhone,
    notification_sms_phone: notificationSmsPhone,
    updated_at: new Date().toISOString(),
  })

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/admin/staff')
}
