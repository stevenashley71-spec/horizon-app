'use server'

import { revalidatePath } from 'next/cache'

import { getTemporaryHorizonAdminResult } from '@/lib/admin-auth'
import { createServerSupabase, createServiceRoleSupabase } from '@/lib/supabase/server'

const CLINIC_LOGO_BUCKET = 'clinic-logos'
const MAX_LOGO_SIZE_BYTES = 5 * 1024 * 1024

function generateClinicVerificationCode(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 10).toUpperCase()
  return `${prefix}-${random}`
}

function slugifyFileName(fileName: string) {
  return fileName
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function getLogoPath(clinicId: string, fileName: string) {
  return `${clinicId}/${Date.now()}-${slugifyFileName(fileName || 'logo')}`
}

async function uploadClinicLogo(clinicId: string, file: File) {
  if (!file.type.startsWith('image/')) {
    throw new Error('Logo must be an image file')
  }

  if (file.size > MAX_LOGO_SIZE_BYTES) {
    throw new Error('Logo must be 5MB or smaller')
  }

  const supabase = createServiceRoleSupabase()
  const filePath = getLogoPath(clinicId, file.name)
  const fileBuffer = await file.arrayBuffer()

  const { error } = await supabase.storage
    .from(CLINIC_LOGO_BUCKET)
    .upload(filePath, fileBuffer, {
      contentType: file.type,
      upsert: false,
    })

  if (error) {
    throw new Error(error.message)
  }

  return filePath
}

async function removeClinicLogoIfPresent(logoPath: string | null | undefined) {
  if (!logoPath) {
    return
  }

  const supabase = createServiceRoleSupabase()
  await supabase.storage.from(CLINIC_LOGO_BUCKET).remove([logoPath])
}

async function requireTemporaryAdminAccess() {
  const adminResult = await getTemporaryHorizonAdminResult()

  if (!adminResult) {
    throw new Error('Authentication required')
  }

  if (adminResult.kind !== 'ok') {
    throw new Error(adminResult.message)
  }
}

export async function deleteClinicAdmin(): Promise<never> {
  await requireTemporaryAdminAccess()

  throw new Error('Clinic deletion is not allowed. Use deactivate instead.')
}

export async function saveClinicAdmin(formData: FormData) {
  await requireTemporaryAdminAccess()

  const supabase = createServiceRoleSupabase()

  const clinicIdValue = formData.get('clinic_id')
  const clinicId = typeof clinicIdValue === 'string' && clinicIdValue ? clinicIdValue : null
  const name = String(formData.get('name') ?? '').trim()
  const code = String(formData.get('code') ?? '').trim() || null
  const pickupVerificationCode =
    String(formData.get('pickup_verification_code') ?? '').trim() || null
  const deliveryVerificationCode =
    String(formData.get('delivery_verification_code') ?? '').trim() || null
  const addressLine1 = String(formData.get('address_line_1') ?? '').trim() || null
  const addressLine2 = String(formData.get('address_line_2') ?? '').trim() || null
  const city = String(formData.get('city') ?? '').trim() || null
  const state = String(formData.get('state') ?? '').trim() || null
  const zip = String(formData.get('zip') ?? '').trim() || null
  const phone = String(formData.get('phone') ?? '').trim() || null
  const email = String(formData.get('email') ?? '').trim() || null
  const allowsDonationIntake = String(formData.get('allows_donation_intake') ?? '') === 'true'
  const password = String(formData.get('password') ?? '')
  const logoAltText = String(formData.get('logo_alt_text') ?? '').trim() || null
  const removeLogo = String(formData.get('remove_logo') ?? '') === 'true'
  const logoFileEntry = formData.get('logo_file')
  const logoFile =
    logoFileEntry instanceof File && logoFileEntry.size > 0 ? logoFileEntry : null

  if (!clinicId && !name) {
    throw new Error('Clinic name is required')
  }

  let existingClinic:
    | {
        id: string
        logo_path: string | null
      }
    | null = null
  let createdAuthUserId: string | null = null

  if (clinicId) {
    const { data, error } = await supabase
      .from('clinics')
      .select('id, logo_path')
      .eq('id', clinicId)
      .single()

    if (error || !data) {
      throw new Error(error?.message || 'Clinic not found')
    }

    existingClinic = data

    const { data: linkedClinicUser } = await supabase
      .from('clinic_users')
      .select('user_id')
      .eq('clinic_id', clinicId)
      .maybeSingle()

    if (!linkedClinicUser && email && password) {
      if (!email) {
        throw new Error('Email / username is required')
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
        throw new Error(createUserError?.message || 'Failed to create clinic auth user')
      }

      createdAuthUserId = createdUser.user.id

      const { error: clinicUserError } = await supabase
        .from('clinic_users')
        .insert({
          user_id: createdAuthUserId,
          clinic_id: clinicId,
        })

      if (clinicUserError) {
        await supabase.auth.admin.deleteUser(createdAuthUserId)
        throw new Error(clinicUserError.message)
      }
    }
  }

  const baseFields = {
    name,
    code,
    pickup_verification_code: pickupVerificationCode,
    delivery_verification_code: deliveryVerificationCode,
    address_line_1: addressLine1,
    address_line_2: addressLine2,
    city,
    state,
    zip,
    phone,
    email,
    allows_donation_intake: allowsDonationIntake,
    logo_alt_text: logoAltText,
    updated_at: new Date().toISOString(),
  }

  let targetClinicId = clinicId
  let currentLogoPath = existingClinic?.logo_path ?? null

  if (!targetClinicId) {
    const generatedPickupVerificationCode =
      pickupVerificationCode ?? generateClinicVerificationCode('HPCP')
    const generatedDeliveryVerificationCode =
      deliveryVerificationCode ?? generateClinicVerificationCode('HPCD')

    const { data, error } = await supabase
      .from('clinics')
      .insert({
        ...baseFields,
        pickup_verification_code: generatedPickupVerificationCode,
        delivery_verification_code: generatedDeliveryVerificationCode,
        is_active: true,
      })
      .select('id, logo_path')
      .single()

    if (error || !data) {
      throw new Error(error?.message || 'Failed to create clinic')
    }

    targetClinicId = data.id
    currentLogoPath = data.logo_path

    const { data: createdUser, error: createUserError } = await supabase.auth.admin.createUser({
      email: email ?? '',
      password,
      email_confirm: true,
    })

    if (createUserError || !createdUser.user) {
      await supabase.from('clinics').delete().eq('id', targetClinicId)
      throw new Error(createUserError?.message || 'Failed to create clinic auth user')
    }

    createdAuthUserId = createdUser.user.id

    const { error: clinicUserError } = await supabase
      .from('clinic_users')
      .insert({
        user_id: createdAuthUserId,
        clinic_id: targetClinicId,
      })

    if (clinicUserError) {
      await supabase.auth.admin.deleteUser(createdAuthUserId)
      await supabase.from('clinics').delete().eq('id', targetClinicId)
      throw new Error(clinicUserError.message)
    }
  }

  if (!targetClinicId) {
    throw new Error('Clinic id is required')
  }

  let nextLogoPath = currentLogoPath
  let uploadedLogoPath: string | null = null

  if (removeLogo) {
    nextLogoPath = null
  }

  if (logoFile) {
    uploadedLogoPath = await uploadClinicLogo(targetClinicId, logoFile)
    nextLogoPath = uploadedLogoPath
  }

  const {
    pickup_verification_code: _pickupVerificationCode,
    delivery_verification_code: _deliveryVerificationCode,
    ...updateFields
  } = baseFields

  const { error: updateError } = await supabase
    .from('clinics')
    .update({
      ...updateFields,
      logo_path: nextLogoPath,
    })
    .eq('id', targetClinicId)

  if (updateError) {
    if (uploadedLogoPath) {
      await removeClinicLogoIfPresent(uploadedLogoPath)
    }

    throw new Error(updateError.message)
  }

  if ((removeLogo || uploadedLogoPath) && currentLogoPath && currentLogoPath !== nextLogoPath) {
    await removeClinicLogoIfPresent(currentLogoPath)
  }

  revalidatePath('/admin/clinics')

  return { success: true }
}

export async function setClinicActive(clinicId: string, isActive: boolean): Promise<void> {
  await requireTemporaryAdminAccess()

  const supabase = createServiceRoleSupabase()

  const { error } = await supabase
    .from('clinics')
    .update({
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq('id', clinicId)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/admin/clinics')
}

export async function archiveClinicAdmin(clinicId: string): Promise<void> {
  await requireTemporaryAdminAccess()

  const normalizedClinicId = clinicId.trim()

  if (!normalizedClinicId) {
    throw new Error('Clinic is required')
  }

  const supabase = createServiceRoleSupabase()

  const { data: existingClinic, error: existingClinicError } = await supabase
    .from('clinics')
    .select('id, archived_at')
    .eq('id', normalizedClinicId)
    .maybeSingle()

  if (existingClinicError) {
    throw new Error(existingClinicError.message)
  }

  if (!existingClinic) {
    throw new Error('Clinic not found')
  }

  if (!existingClinic.archived_at) {
    const { error } = await supabase
      .from('clinics')
      .update({
        archived_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', normalizedClinicId)

    if (error) {
      throw new Error(error.message)
    }
  }

  revalidatePath('/admin/clinics')
}

export async function updateClinicExitPinAdmin(
  formData: FormData
): Promise<{ success: true }> {
  await requireTemporaryAdminAccess()

  const supabase = createServiceRoleSupabase()
  const clinicId = String(formData.get('clinic_id') ?? '').trim()
  const exitPin = String(formData.get('exit_pin') ?? '')

  if (!clinicId) {
    throw new Error('Clinic is required')
  }

  const { error } = await supabase
    .from('clinics')
    .update({
      exit_pin: exitPin === '' ? null : exitPin,
      updated_at: new Date().toISOString(),
    })
    .eq('id', clinicId)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/admin/clinics')

  return { success: true }
}
