'use server'

import { getUserRole } from '@/lib/auth/get-user-role'
import { getClinicContextResult } from '@/lib/clinic-auth'
import { createServiceRoleSupabase } from '@/lib/supabase/server'

type MemorialItemSnapshot = {
  product_id: string
  name: string
  price_cents: number
}

type SaveIntakeDraftInput = {
  draftId: string
  memorial_items: MemorialItemSnapshot[]
  memorial_items_total_cents: number
}

type SaveIntakeDraftResult = {
  id: string
  updatedAt: string
}

type IntakeDraftLookupRow = {
  id: string
  status: 'draft' | 'client_review' | 'ready_for_submission' | 'submitted' | 'abandoned'
  product_snapshot: unknown
}

type IntakeDraftUpdateRow = {
  id: string
  updated_at: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function saveIntakeDraft(
  input: SaveIntakeDraftInput
): Promise<SaveIntakeDraftResult> {
  const userRole = await getUserRole()
  const clinicResult = await getClinicContextResult()

  if (!userRole || !clinicResult || clinicResult.kind !== 'ok') {
    throw new Error('Authentication required')
  }

  const supabase = createServiceRoleSupabase()

  const { data: draft, error: draftError } = await supabase
    .from('intake_drafts')
    .select('id, status, product_snapshot')
    .eq('id', input.draftId)
    .eq('clinic_id', clinicResult.clinic.clinicId)
    .single()

  if (draftError || !draft) {
    throw new Error('Draft not found')
  }

  const typedDraft = draft as IntakeDraftLookupRow

  if (typedDraft.status === 'submitted') {
    throw new Error('Draft is locked')
  }

  const existingProductSnapshot = isRecord(typedDraft.product_snapshot)
    ? typedDraft.product_snapshot
    : {}

  const nextProductSnapshot = {
    ...existingProductSnapshot,
    memorial_items: input.memorial_items,
    memorial_items_total_cents: input.memorial_items_total_cents,
  }

  const { data, error } = await supabase
    .from('intake_drafts')
    .update({
      product_snapshot: nextProductSnapshot,
      last_updated_by_user_id: userRole.userId,
    })
    .eq('id', input.draftId)
    .eq('clinic_id', clinicResult.clinic.clinicId)
    .select('id, updated_at')
    .single()

  if (error || !data) {
    throw new Error('Unable to save draft')
  }

  const updatedDraft = data as IntakeDraftUpdateRow

  return {
    id: updatedDraft.id,
    updatedAt: updatedDraft.updated_at,
  }
}
