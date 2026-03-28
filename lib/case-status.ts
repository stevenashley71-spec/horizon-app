export const CASE_STATUSES = [
  'new',
  'received',
  'in_progress',
  'cremated',
  'ready_for_return',
  'completed',
  'on_hold',
  'cancelled',
] as const

export type CaseStatus = (typeof CASE_STATUSES)[number]

export const CASE_STATUS_TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
  new: ['received', 'cancelled'],
  received: ['in_progress', 'on_hold', 'cancelled'],
  in_progress: ['cremated', 'on_hold', 'cancelled'],
  cremated: ['ready_for_return'],
  ready_for_return: ['completed'],
  completed: [],
  on_hold: ['received', 'in_progress', 'cancelled'],
  cancelled: [],
}

export function isCaseStatus(value: string): value is CaseStatus {
  return CASE_STATUSES.includes(value as CaseStatus)
}

export function getAllowedNextStatuses(currentStatus: string | null | undefined): CaseStatus[] {
  if (!currentStatus || !isCaseStatus(currentStatus)) {
    return []
  }

  return CASE_STATUS_TRANSITIONS[currentStatus]
}

export function canTransitionCaseStatus(
  currentStatus: string | null | undefined,
  nextStatus: string
): nextStatus is CaseStatus {
  return getAllowedNextStatuses(currentStatus).includes(nextStatus as CaseStatus)
}

export function formatCaseStatus(status: string | null | undefined) {
  return status?.replaceAll('_', ' ').toUpperCase() || 'UNKNOWN'
}
