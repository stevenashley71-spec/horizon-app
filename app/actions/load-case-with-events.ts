'use server'

import { getTemporaryHorizonAdminResult } from '@/lib/admin-auth'
import { createServiceRoleSupabase } from '@/lib/supabase/server'
import { resolveWorkflow } from '@/lib/workflow/resolve-workflow'

type LoadedCase = {
  id: string
  case_number: string
  cremation_type: string | null
  clinic_id: string | null
  pickup_verification_code: string | null
  currentStep: string | null
  nextStep: string | null
  nextStepCompletionCode: string | null
  isComplete: boolean
}

type LoadedCaseEvent = {
  id: string
  event_type: string
  created_at: string
  created_by: string | null
  metadata?: Record<string, unknown> | null
}

export async function loadCaseWithEvents(caseNumber: string): Promise<{
  caseItem: LoadedCase
  caseEvents: LoadedCaseEvent[]
}> {
  const adminResult = await getTemporaryHorizonAdminResult()

  if (!adminResult || adminResult.kind !== 'ok') {
    throw new Error('Horizon admin access is required')
  }

  const supabase = createServiceRoleSupabase()

  const { data: caseItem, error: caseError } = await supabase
    .from('cases')
    .select('id, case_number, cremation_type, clinic_id, clinics(pickup_verification_code)')
    .eq('case_number', caseNumber)
    .single()

  if (caseError || !caseItem) {
    throw new Error(caseError?.message || 'Case not found.')
  }

  const { data: caseEvents, error: caseEventsError } = await supabase
    .from('case_events')
    .select('id, event_type, created_at, created_by, metadata')
    .eq('case_id', caseItem.id)
    .order('created_at', { ascending: true })

  if (caseEventsError) {
    throw new Error(caseEventsError.message)
  }

  const typedCaseEvents = (caseEvents ?? []) as LoadedCaseEvent[]
  const typedCaseItem = caseItem as {
    id: string
    case_number: string
    cremation_type: string | null
    clinic_id: string | null
    clinics?: {
      pickup_verification_code?: string | null
    } | null
  }
  const workflow = await resolveWorkflow({
    caseId: typedCaseItem.id,
    cremationType: typedCaseItem.cremation_type === 'general' ? 'general' : 'private',
    events: typedCaseEvents.map((event) => ({
      event_type: event.event_type,
      created_at: event.created_at,
    })),
  })

  return {
    caseItem: {
      id: typedCaseItem.id,
      case_number: typedCaseItem.case_number,
      cremation_type: typedCaseItem.cremation_type,
      clinic_id: typedCaseItem.clinic_id ?? null,
      pickup_verification_code:
        typeof typedCaseItem.clinics?.pickup_verification_code === 'string'
          ? typedCaseItem.clinics.pickup_verification_code
          : null,
      currentStep: workflow.currentStep,
      nextStep: workflow.nextStep,
      nextStepCompletionCode: workflow.nextStepCompletionCode,
      isComplete: workflow.isComplete,
    },
    caseEvents: typedCaseEvents,
  }
}
