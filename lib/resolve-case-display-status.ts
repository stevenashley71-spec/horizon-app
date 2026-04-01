const MANUAL_ONLY_CASE_STATUSES = new Set(['on_hold', 'cancelled'])

export function resolveCaseDisplayStatus(
  storedStatus: string | null | undefined,
  _events: { event_type?: string | null }[] | null | undefined
) {
  if (storedStatus && MANUAL_ONLY_CASE_STATUSES.has(storedStatus)) {
    return storedStatus
  }

  return storedStatus ?? null
}
