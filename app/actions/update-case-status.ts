'use server'

import { CASE_EVENT_TYPES } from '@/lib/case-events'
import { createServerSupabase } from '@/lib/supabase/server'
import { canTransitionCaseStatus, isCaseStatus } from '@/lib/case-status'
import { revalidatePath } from 'next/cache'

type UpdateCaseStatusOptions = {
  isAdmin?: boolean
  bypassEventLock?: boolean
}

const MANUAL_ONLY_STATUSES = new Set(['on_hold', 'cancelled'])

export async function updateCaseStatus(
  id: string,
  status: string,
  options: UpdateCaseStatusOptions = {}
) {
  if (!isCaseStatus(status)) {
    throw new Error('Invalid status')
  }

  if (!MANUAL_ONLY_STATUSES.has(status)) {
    throw new Error('Operational status changes must be performed via case events')
  }

  const supabase = createServerSupabase()

  const { data: existingCase, error: existingCaseError } = await supabase
    .from('cases')
    .select('id, case_number, status')
    .eq('id', id)
    .single()

  if (existingCaseError || !existingCase) {
    throw new Error(existingCaseError?.message || 'Case not found')
  }

  const { count: caseEventCount, error: caseEventCountError } = await supabase
    .from('case_events')
    .select('*', { count: 'exact', head: true })
    .eq('case_id', id)

  if (caseEventCountError) {
    throw new Error(caseEventCountError.message)
  }

  if ((caseEventCount ?? 0) > 0 && !options.isAdmin && !options.bypassEventLock) {
    throw new Error('Status is controlled by chain-of-custody events')
  }

  if (!canTransitionCaseStatus(existingCase.status, status) && existingCase.status !== status) {
    throw new Error(`Invalid status transition from ${existingCase.status} to ${status}`)
  }

  const { error: caseEventError } = await supabase.from('case_events').insert({
    case_id: id,
    case_number: existingCase.case_number,
    event_type: CASE_EVENT_TYPES.STATUS_UPDATED,
    created_by: null,
  })

  if (caseEventError) {
    throw new Error(caseEventError.message)
  }

  const { error: statusHistoryError } = await supabase.from('case_status_history').insert({
    case_id: id,
    case_number: existingCase.case_number,
    previous_status: existingCase.status,
    new_status: status,
    changed_by: null,
  })

  if (statusHistoryError) {
    throw new Error(statusHistoryError.message)
  }

  revalidatePath('/cases')
  revalidatePath(`/cases/${id}`)

  return { success: true }
}
