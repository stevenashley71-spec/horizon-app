'use server'

import { revalidatePath } from 'next/cache'

import {
  ALL_CASE_EVENT_TYPES,
  isCaseEventType,
  isOperationalCaseEventType,
} from '@/lib/case-events'
import { resolveWorkflow } from '@/lib/workflow/resolve-workflow'
import { getClinicContextResult } from '@/lib/clinic-auth'
import { getInternalHorizonUserResult } from '@/lib/internal-auth'
import {
  createServerAuthSupabase,
  createServiceRoleSupabase,
} from '@/lib/supabase/server'

export async function addCaseEvent(
  caseId: string,
  eventType: string,
  scanContext?: {
    scannedCode?: string | null
    scanMode?: string | null
  }
) {
  if (!caseId?.trim()) {
    throw new Error('Case ID is required')
  }

  if (!ALL_CASE_EVENT_TYPES.includes(eventType as (typeof ALL_CASE_EVENT_TYPES)[number])) {
    throw new Error(`Invalid case event type: ${eventType}`)
  }

  if (!isCaseEventType(eventType)) {
    throw new Error('Invalid event type')
  }

  const authSupabase = await createServerAuthSupabase()
  const {
    data: { user },
  } = await authSupabase.auth.getUser()

  if (!user) {
    throw new Error('Authentication required')
  }

  const clinicResult = await getClinicContextResult()

  if (clinicResult?.kind === 'ok') {
    throw new Error('Clinic users are not allowed to create operational case events')
  }

  const internalUserResult = await getInternalHorizonUserResult()

  if (!internalUserResult || internalUserResult.kind !== 'ok') {
    throw new Error('Internal Horizon access is required to create case events')
  }

  const serviceRoleSupabase = createServiceRoleSupabase()

  const { data: caseItem, error: caseError } = await serviceRoleSupabase
    .from('cases')
    .select('id, case_number, status, cremation_type')
    .eq('id', caseId)
    .single()

  if (!caseItem) {
    throw new Error('Case not found')
  }

  if (caseError) {
    throw new Error('Unable to load case')
  }

  const { data: existingEvents, error: existingEventsError } = await serviceRoleSupabase
    .from('case_events')
    .select('event_type, created_at')
    .eq('case_id', caseId)
    .order('created_at', { ascending: false })

  if (existingEventsError) {
    throw new Error('Unable to load case events')
  }

  const workflow = await resolveWorkflow({
    caseId: caseItem.id,
    cremationType: caseItem.cremation_type === 'general' ? 'general' : 'private',
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

  const workflowOptions = { cremationType: caseItem.cremation_type }
  const isOperationallyBlocked =
    caseItem.status === 'on_hold' || caseItem.status === 'cancelled'

  if (isOperationalCaseEventType(eventType)) {
    if (isOperationallyBlocked) {
      throw new Error(
        caseItem.status === 'on_hold'
          ? 'Operational events are unavailable while this case is on hold.'
          : 'Operational events are unavailable while this case is cancelled.'
      )
    }

    if (workflow.isComplete) {
      throw new Error('Workflow is complete')
    }

    if (workflow.allowedNextSteps.length === 0) {
      throw new Error('Workflow is complete')
    }

    if (!workflow.allowedNextSteps.includes(eventType)) {
      throw new Error('Invalid workflow step')
    }

    const matchingAllowedStepDetail =
      workflow.allowedNextStepDetails.find((step) => step.code === eventType) ?? null

    if (matchingAllowedStepDetail?.requiresScan && !scanContext?.scannedCode?.trim()) {
      throw new Error('Scan is required for this workflow step')
    }
  }

  const { error: insertError } = await serviceRoleSupabase.from('case_events').insert({
    case_id: caseId,
    case_number: caseItem.case_number,
    event_type: eventType,
    created_by: user.id,
    metadata:
      scanContext?.scannedCode || scanContext?.scanMode
        ? {
            scannedCode: scanContext.scannedCode ?? null,
            scanMode: scanContext.scanMode ?? null,
          }
        : {},
  })

  if (insertError) {
    throw new Error('Unable to create case event')
  }

  revalidatePath(`/cases/${caseId}`)

  return { success: true }
}
