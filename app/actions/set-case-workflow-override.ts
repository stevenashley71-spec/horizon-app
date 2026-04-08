'use server'

import { revalidatePath } from 'next/cache'

import { getTemporaryHorizonAdminResult as getAdminHorizonUserResult } from '@/lib/admin-auth'
import { getClinicContextResult } from '@/lib/clinic-auth'
import {
  getWorkflowSupportedStepCodes,
  resolveWorkflow,
} from '@/lib/workflow/resolve-workflow'
import {
  createServerAuthSupabase,
  createServiceRoleSupabase,
} from '@/lib/supabase/server'

export async function setCaseWorkflowOverride(
  caseId: string,
  targetStepCode: string,
  reason: string
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
    throw new Error('Clinic users are not allowed to override workflow')
  }

  const adminResult = await getAdminHorizonUserResult()

  if (!adminResult || adminResult.kind !== 'ok') {
    throw new Error('Horizon admin access is required to override workflow')
  }

  const normalizedCaseId = caseId.trim()
  const normalizedTargetStepCode = targetStepCode.trim()
  const normalizedReason = reason.trim()

  if (!normalizedCaseId) {
    throw new Error('Case ID is required')
  }

  if (!normalizedTargetStepCode) {
    throw new Error('Target workflow step is required')
  }

  if (!normalizedReason) {
    throw new Error('Reason is required')
  }

  const serviceRoleSupabase = createServiceRoleSupabase()

  const { data: existingCase, error: existingCaseError } = await serviceRoleSupabase
    .from('cases')
    .select('id, status, cremation_type')
    .eq('id', normalizedCaseId)
    .maybeSingle()

  if (existingCaseError) {
    throw new Error('Unable to load case')
  }

  if (!existingCase) {
    throw new Error('Case not found')
  }

  const supportedStepCodes = await getWorkflowSupportedStepCodes(
    existingCase.cremation_type === 'general' ? 'general' : 'private'
  )

  if (!supportedStepCodes.includes(normalizedTargetStepCode)) {
    throw new Error('Invalid workflow step for this case')
  }

  const { error: insertError } = await serviceRoleSupabase
    .from('case_workflow_overrides')
    .insert({
      case_id: normalizedCaseId,
      target_step_code: normalizedTargetStepCode,
      reason: normalizedReason,
      created_by: user.id,
    })

  if (insertError) {
    throw new Error('Unable to create case workflow override')
  }

  const { data: existingEvents, error: existingEventsError } = await serviceRoleSupabase
    .from('case_events')
    .select('event_type, created_at')
    .eq('case_id', normalizedCaseId)
    .order('created_at', { ascending: false })

  if (existingEventsError) {
    throw new Error('Unable to load case events')
  }

  const workflow = await resolveWorkflow({
    caseId: normalizedCaseId,
    cremationType: existingCase.cremation_type === 'general' ? 'general' : 'private',
    events: (existingEvents ?? []).flatMap((event) =>
      typeof event.event_type === 'string' && typeof event.created_at === 'string'
        ? [
            {
              event_type: event.event_type,
              created_at: event.created_at,
            },
          ]
        : []
    ),
  })

  const derivedCaseStatus = workflow.derivedCaseStatus ?? existingCase.status ?? 'new'

  if (existingCase.status !== derivedCaseStatus) {
    const { error: caseStatusUpdateError } = await serviceRoleSupabase
      .from('cases')
      .update({
        status: derivedCaseStatus,
      })
      .eq('id', normalizedCaseId)

    if (caseStatusUpdateError) {
      throw new Error('Unable to update case status')
    }
  }

  revalidatePath(`/cases/${normalizedCaseId}`)
  revalidatePath('/cases')
  revalidatePath('/dashboard')
  revalidatePath('/pickup')

  return { success: true }
}
