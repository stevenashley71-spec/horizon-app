'use server'

import { revalidatePath } from 'next/cache'

import { requireHorizonAdmin } from '@/lib/horizon-admin'
import { createServerSupabase } from '@/lib/supabase/server'

const CLINIC_LOGO_BUCKET = 'clinic-logos'
const MAX_LOGO_SIZE_BYTES = 5 * 1024 * 1024

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

  const supabase = createServerSupabase()
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

  const supabase = createServerSupabase()
  await supabase.storage.from(CLINIC_LOGO_BUCKET).remove([logoPath])
}

export async function saveClinicAdmin(formData: FormData) {
  requireHorizonAdmin()

  const supabase = createServerSupabase()

  const clinicIdValue = formData.get('clinic_id')
  const clinicId = typeof clinicIdValue === 'string' && clinicIdValue ? clinicIdValue : null
  const name = String(formData.get('name') ?? '').trim()
  const code = String(formData.get('code') ?? '').trim() || null
  const addressLine1 = String(formData.get('address_line_1') ?? '').trim() || null
  const addressLine2 = String(formData.get('address_line_2') ?? '').trim() || null
  const city = String(formData.get('city') ?? '').trim() || null
  const state = String(formData.get('state') ?? '').trim() || null
  const zip = String(formData.get('zip') ?? '').trim() || null
  const phone = String(formData.get('phone') ?? '').trim() || null
  const email = String(formData.get('email') ?? '').trim() || null
  const logoAltText = String(formData.get('logo_alt_text') ?? '').trim() || null
  const removeLogo = String(formData.get('remove_logo') ?? '') === 'true'
  const logoFileEntry = formData.get('logo_file')
  const logoFile =
    logoFileEntry instanceof File && logoFileEntry.size > 0 ? logoFileEntry : null

  if (!name) {
    throw new Error('Clinic name is required')
  }

  let existingClinic:
    | {
        id: string
        logo_path: string | null
      }
    | null = null

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
  }

  const baseFields = {
    name,
    code,
    address_line_1: addressLine1,
    address_line_2: addressLine2,
    city,
    state,
    zip,
    phone,
    email,
    logo_alt_text: logoAltText,
    updated_at: new Date().toISOString(),
  }

  let targetClinicId = clinicId
  let currentLogoPath = existingClinic?.logo_path ?? null

  if (!targetClinicId) {
    const { data, error } = await supabase
      .from('clinics')
      .insert({
        ...baseFields,
        is_active: true,
      })
      .select('id, logo_path')
      .single()

    if (error || !data) {
      throw new Error(error?.message || 'Failed to create clinic')
    }

    targetClinicId = data.id
    currentLogoPath = data.logo_path
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

  const { error: updateError } = await supabase
    .from('clinics')
    .update({
      ...baseFields,
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

export async function setClinicActive(clinicId: string, isActive: boolean) {
  requireHorizonAdmin()

  const supabase = createServerSupabase()

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

  return { success: true }
}
