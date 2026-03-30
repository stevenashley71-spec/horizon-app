'use server'

import { getTemporaryHorizonAdminResult as getAdminHorizonUserResult } from '@/lib/admin-auth'
import { getClinicContextResult } from '@/lib/clinic-auth'
import {
  createServerAuthSupabase,
  createServiceRoleSupabase,
} from '@/lib/supabase/server'
import { canTransitionCaseStatus, isCaseStatus } from '@/lib/case-status'
import { revalidatePath } from 'next/cache'

const MANUAL_ONLY_STATUSES = new Set(['on_hold', 'cancelled'])

export async function updateCaseStatus(
  id: string,
  status: string
) {
  const authSupabase = await createServerAuthSupabase()
  const {
    data: { user },
  } = await authSupabase.auth.getUser()

  if (!user) {
    throw new Error('Authentication required')
  }

  const clinicResult = await getClinicContextResult()

  if (clinicResult?.kind === 'ok') {
    throw new Error('Clinic users are not allowed to manually change internal case status')
  }

  const adminResult = await getAdminHorizonUserResult()

  if (!adminResult || adminResult.kind !== 'ok') {
    throw new Error('Horizon admin access is required to change case status')
  }

  const canBypassEventLock = true

  if (!isCaseStatus(status)) {
    throw new Error('Invalid status')
  }

  if (!MANUAL_ONLY_STATUSES.has(status)) {
    throw new Error('Operational status changes must be performed via case events')
  }

  const serviceRoleSupabase = createServiceRoleSupabase()

  const { data: existingCase, error: existingCaseError } = await serviceRoleSupabase
    .from('cases')
    .select('id, case_number, status')
    .eq('id', id)
    .single()

  if (!existingCase) {
    throw new Error('Case not found')
  }

  if (existingCaseError) {
    throw new Error('Unable to load case')
  }

  const { count: caseEventCount, error: caseEventCountError } = await serviceRoleSupabase
    .from('case_events')
    .select('*', { count: 'exact', head: true })
    .eq('case_id', id)

  if (caseEventCountError) {
    throw new Error('Unable to load case events')
  }

  if ((caseEventCount ?? 0) > 0 && !canBypassEventLock) {
    throw new Error('Status is controlled by chain-of-custody events')
  }

  if (!canTransitionCaseStatus(existingCase.status, status) && existingCase.status !== status) {
    throw new Error(`Invalid status transition from ${existingCase.status} to ${status}`)
  }

  const { error: caseUpdateError } = await serviceRoleSupabase.rpc(
    'update_case_status_with_history',
    {
      target_case_id: id,
      next_status: status,
      changed_by: user.id,
    }
  )

  if (caseUpdateError) {
    throw new Error('Unable to update case status')
  }

  revalidatePath('/cases')
  revalidatePath(`/cases/${id}`)

  return { success: true }
}
