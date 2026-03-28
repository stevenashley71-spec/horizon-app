'use server'

import { revalidatePath } from 'next/cache'

import { ALL_CASE_EVENT_TYPES, isCaseEventType } from '@/lib/case-events'
import {
  getCurrentWorkflowStep,
  getNextAllowedEventType,
  getOrderedOperationalEventTypes,
  isCaseWorkflowComplete,
} from '@/lib/case-workflow'
import { createServerSupabase } from '@/lib/supabase/server'

type AddCaseEventOptions = {
  created_by?: string | null
  metadata?: Record<string, unknown>
}

export async function addCaseEvent(
  caseId: string,
  eventType: string,
  options: AddCaseEventOptions = {}
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

  const supabase = createServerSupabase()

  const { data: caseItem, error: caseError } = await supabase
    .from('cases')
    .select('id, case_number, status, cremation_type')
    .eq('id', caseId)
    .single()

  if (caseError || !caseItem) {
    throw new Error(caseError?.message || 'Case not found')
  }

  const { data: existingEvents, error: existingEventsError } = await supabase
    .from('case_events')
    .select('event_type, created_at')
    .eq('case_id', caseId)
    .order('created_at', { ascending: false })

  if (existingEventsError) {
    throw new Error(existingEventsError.message)
  }

  const workflowOptions = { cremationType: caseItem.cremation_type }
  const operationalEventTypes = new Set([
    ...getOrderedOperationalEventTypes({ cremationType: 'private' }),
    ...getOrderedOperationalEventTypes({ cremationType: 'general' }),
  ])
  const isOperationallyBlocked =
    caseItem.status === 'on_hold' || caseItem.status === 'cancelled'

  if (operationalEventTypes.has(eventType)) {
    if (isOperationallyBlocked) {
      throw new Error(
        caseItem.status === 'on_hold'
          ? 'Operational events are unavailable while this case is on hold.'
          : 'Operational events are unavailable while this case is cancelled.'
      )
    }

    if (isCaseWorkflowComplete(existingEvents, workflowOptions)) {
      throw new Error('Workflow is already complete. No further operational events are allowed.')
    }

    const nextAllowedEventType = getNextAllowedEventType(existingEvents, workflowOptions)

    if (eventType !== nextAllowedEventType) {
      const currentWorkflowStep = getCurrentWorkflowStep(existingEvents, workflowOptions)

      throw new Error(
        `Invalid event order. Expected ${nextAllowedEventType ?? 'no further events'}, received ${eventType}. Current workflow step: ${currentWorkflowStep ?? 'none'}.`
      )
    }
  }

  const { error: insertError } = await supabase.from('case_events').insert({
    case_id: caseId,
    case_number: caseItem.case_number,
    event_type: eventType,
    created_by: options.created_by ?? null,
    metadata: options.metadata ?? {},
  })

  if (insertError) {
    throw new Error(insertError.message)
  }

  revalidatePath(`/cases/${caseId}`)

  return { success: true }
}
