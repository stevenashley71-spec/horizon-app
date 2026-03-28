import { deriveCaseStatusFromEvents } from '@/lib/derive-case-status'

type CaseEventLike = {
  event_type?: string | null
}

const MANUAL_ONLY_CASE_STATUSES = new Set(['on_hold', 'cancelled'])

export function resolveCaseDisplayStatus(
  storedStatus: string | null | undefined,
  events: CaseEventLike[] | null | undefined
) {
  if (storedStatus && MANUAL_ONLY_CASE_STATUSES.has(storedStatus)) {
    return storedStatus
  }

  return deriveCaseStatusFromEvents(events) ?? storedStatus ?? null
}
