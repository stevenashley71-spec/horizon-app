import { CASE_EVENT_TYPES } from '@/lib/case-events'

type CaseEventLike = {
  event_type?: string | null
}

const EVENT_STATUS_MAP: Record<string, string> = {
  [CASE_EVENT_TYPES.PICKED_UP]: 'new',
  [CASE_EVENT_TYPES.RECEIVED_AT_FACILITY]: 'received',
  [CASE_EVENT_TYPES.CREMATION_STARTED]: 'in_progress',
  [CASE_EVENT_TYPES.CREMATION_COMPLETED]: 'cremated',
  [CASE_EVENT_TYPES.PACKAGED]: 'ready_for_return',
  [CASE_EVENT_TYPES.RETURNED]: 'completed',
}

export function deriveCaseStatusFromEvents(events: CaseEventLike[] | null | undefined) {
  const latestEventType = events?.[0]?.event_type

  if (!latestEventType) {
    return null
  }

  if (
    latestEventType === CASE_EVENT_TYPES.CASE_CREATED ||
    latestEventType === CASE_EVENT_TYPES.STATUS_UPDATED
  ) {
    return null
  }

  return EVENT_STATUS_MAP[latestEventType] ?? null
}
