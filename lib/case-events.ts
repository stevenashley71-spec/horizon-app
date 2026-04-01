export const CASE_EVENT_TYPES = {
  CASE_CREATED: 'case_created',
  STATUS_UPDATED: 'status_updated',
  PICKED_UP: 'picked_up',
  RECEIVED_AT_FACILITY: 'received_at_facility',
  CLAY_PAW_PRINT: 'clay_paw_print',
  NOSE_PRINT: 'nose_print',
  FUR_CLIPPING: 'fur_clipping',
  CREMATION_STARTED: 'cremation_started',
  CREMATION_COMPLETED: 'cremation_completed',
  SCATTERED: 'scattered',
  PACKAGED: 'packaged',
  RETURNED: 'returned',
} as const

export type CaseEventType =
  (typeof CASE_EVENT_TYPES)[keyof typeof CASE_EVENT_TYPES]

export const ALL_CASE_EVENT_TYPES: CaseEventType[] = Object.values(CASE_EVENT_TYPES)

export const OPERATIONAL_CASE_EVENT_TYPES: CaseEventType[] = [
  CASE_EVENT_TYPES.CASE_CREATED,
  CASE_EVENT_TYPES.PICKED_UP,
  CASE_EVENT_TYPES.RECEIVED_AT_FACILITY,
  CASE_EVENT_TYPES.CLAY_PAW_PRINT,
  CASE_EVENT_TYPES.NOSE_PRINT,
  CASE_EVENT_TYPES.FUR_CLIPPING,
  CASE_EVENT_TYPES.CREMATION_STARTED,
  CASE_EVENT_TYPES.CREMATION_COMPLETED,
  CASE_EVENT_TYPES.SCATTERED,
  CASE_EVENT_TYPES.PACKAGED,
  CASE_EVENT_TYPES.RETURNED,
]

export function isOperationalCaseEventType(value: string): value is CaseEventType {
  return OPERATIONAL_CASE_EVENT_TYPES.includes(value as CaseEventType)
}

export const CASE_EVENT_STATUS_MAPPING: Partial<Record<CaseEventType, string>> = {
  [CASE_EVENT_TYPES.PICKED_UP]: 'new',
  [CASE_EVENT_TYPES.RECEIVED_AT_FACILITY]: 'received',
  [CASE_EVENT_TYPES.CREMATION_STARTED]: 'in_progress',
  [CASE_EVENT_TYPES.CREMATION_COMPLETED]: 'cremated',
  [CASE_EVENT_TYPES.SCATTERED]: 'completed',
  [CASE_EVENT_TYPES.PACKAGED]: 'ready_for_return',
  [CASE_EVENT_TYPES.RETURNED]: 'completed',
}

export function isCaseEventType(value: string): value is CaseEventType {
  return ALL_CASE_EVENT_TYPES.includes(value as CaseEventType)
}

type CaseEventLike = {
  event_type?: string | null
}

export function formatCaseEventType(eventType: string | null | undefined) {
  if (!eventType) {
    return 'UNKNOWN'
  }

  return eventType
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function getMappedStatusForCaseEvent(eventType: CaseEventType) {
  return CASE_EVENT_STATUS_MAPPING[eventType] ?? null
}

export function getExpectedStatusForLatestCaseEvent(
  latestEventType: string | null | undefined
) {
  if (!latestEventType || !isCaseEventType(latestEventType)) {
    return null
  }

  return getMappedStatusForCaseEvent(latestEventType)
}
