'use server'

import { getTemporaryHorizonAdminResult } from '@/lib/admin-auth'
import { createServiceRoleSupabase } from '@/lib/supabase/server'

type LoadedCase = {
  id: string
  case_number: string
  cremation_type: string | null
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
    .select('id, case_number, cremation_type')
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

  return {
    caseItem: caseItem as LoadedCase,
    caseEvents: (caseEvents ?? []) as LoadedCaseEvent[],
  }
}
