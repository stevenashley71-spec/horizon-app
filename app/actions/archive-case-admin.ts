'use server'

import { revalidatePath } from 'next/cache'

import { getTemporaryHorizonAdminResult as getAdminHorizonUserResult } from '@/lib/admin-auth'
import { getClinicContextResult } from '@/lib/clinic-auth'
import {
  createServerAuthSupabase,
  createServiceRoleSupabase,
} from '@/lib/supabase/server'

export async function archiveCaseAdmin(
  formData: FormData
): Promise<{ success: true }> {
  const authSupabase = await createServerAuthSupabase()
  const {
    data: { user },
  } = await authSupabase.auth.getUser()

  if (!user) {
    throw new Error('Authentication required')
  }

  const clinicResult = await getClinicContextResult()

  if (clinicResult?.kind === 'ok') {
    throw new Error('Clinic users are not allowed to archive cases')
  }

  const adminResult = await getAdminHorizonUserResult()

  if (!adminResult || adminResult.kind !== 'ok') {
    throw new Error('Horizon admin access is required to archive cases')
  }

  const caseId = String(formData.get('case_id') ?? '').trim()

  if (!caseId) {
    throw new Error('Case ID is required')
  }

  const serviceRoleSupabase = createServiceRoleSupabase()

  const { data: existingCase, error: existingCaseError } = await serviceRoleSupabase
    .from('cases')
    .select('id, archived_at')
    .eq('id', caseId)
    .maybeSingle()

  if (existingCaseError) {
    throw new Error('Unable to load case')
  }

  if (!existingCase) {
    throw new Error('Case not found')
  }

  if (!existingCase.archived_at) {
    const { error: archiveError } = await serviceRoleSupabase
      .from('cases')
      .update({
        archived_at: new Date().toISOString(),
      })
      .eq('id', caseId)

    if (archiveError) {
      throw new Error('Unable to archive case')
    }
  }

  revalidatePath('/cases')
  revalidatePath('/dashboard')
  revalidatePath('/pickup')
  revalidatePath('/workroom')

  return { success: true }
}
