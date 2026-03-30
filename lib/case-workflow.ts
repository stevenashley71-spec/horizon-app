import { CASE_EVENT_TYPES, type CaseEventType } from '@/lib/case-events'

type CaseWorkflowEventLike = {
  event_type?: string | null
  created_at?: string | null
}

type CaseWorkflowOptions = {
  cremationType?: string | null
}

const BASE_OPERATIONAL_WORKFLOW_SEQUENCE = [
  CASE_EVENT_TYPES.CASE_CREATED,
  CASE_EVENT_TYPES.PICKED_UP,
  CASE_EVENT_TYPES.RECEIVED_AT_FACILITY,
  'clay_paw_print',
  'nose_print',
  'fur_clipping',
  CASE_EVENT_TYPES.CREMATION_STARTED,
  CASE_EVENT_TYPES.CREMATION_COMPLETED,
] as const

const PRIVATE_OPERATIONAL_WORKFLOW_SEQUENCE = [
  ...BASE_OPERATIONAL_WORKFLOW_SEQUENCE,
  CASE_EVENT_TYPES.PACKAGED,
  CASE_EVENT_TYPES.RETURNED,
] as const

const GENERAL_OPERATIONAL_WORKFLOW_SEQUENCE = [
  ...BASE_OPERATIONAL_WORKFLOW_SEQUENCE,
  CASE_EVENT_TYPES.SCATTERED,
] as const

const ALL_OPERATIONAL_WORKFLOW_EVENT_TYPES = [
  ...new Set([
    ...PRIVATE_OPERATIONAL_WORKFLOW_SEQUENCE,
    ...GENERAL_OPERATIONAL_WORKFLOW_SEQUENCE,
  ]),
] as const

type OperationalWorkflowEventType = (typeof ALL_OPERATIONAL_WORKFLOW_EVENT_TYPES)[number]

function isGeneralCaseWorkflow(options: CaseWorkflowOptions = {}) {
  const cremationType = options.cremationType?.trim().toLowerCase()

  return cremationType === 'general' || cremationType === 'communal'
}

function getOperationalWorkflowSequence(options: CaseWorkflowOptions = {}) {
  return isGeneralCaseWorkflow(options)
    ? GENERAL_OPERATIONAL_WORKFLOW_SEQUENCE
    : PRIVATE_OPERATIONAL_WORKFLOW_SEQUENCE
}

export function isOperationalWorkflowEventType(
  value: string
): value is OperationalWorkflowEventType {
  return ALL_OPERATIONAL_WORKFLOW_EVENT_TYPES.includes(value as OperationalWorkflowEventType)
}

function getEventTimestamp(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const timestamp = new Date(value).getTime()

  return Number.isFinite(timestamp) ? timestamp : null
}

function getSortedOperationalEventTypes(events: CaseWorkflowEventLike[] | null | undefined) {
  if (!Array.isArray(events)) {
    return []
  }

  return events
    .map((event, index) => ({ event, index }))
    .filter(
      (
        item
      ): item is {
        event: CaseWorkflowEventLike & { event_type: OperationalWorkflowEventType }
        index: number
      } =>
        typeof item.event?.event_type === 'string' &&
        isOperationalWorkflowEventType(item.event.event_type)
    )
    .sort((a, b) => {
      const aTime = getEventTimestamp(a.event.created_at)
      const bTime = getEventTimestamp(b.event.created_at)

      if (aTime === null && bTime === null) {
        return a.index - b.index
      }

      if (aTime === null) {
        return 1
      }

      if (bTime === null) {
        return -1
      }

      if (aTime !== bTime) {
        return aTime - bTime
      }

      return a.index - b.index
    })
    .map((item) => item.event.event_type)
}

export function getOrderedOperationalEventTypes(
  options: CaseWorkflowOptions = {}
): OperationalWorkflowEventType[] {
  return [...getOperationalWorkflowSequence(options)]
}

export function getCompletedOperationalEventTypes(
  events: CaseWorkflowEventLike[] | null | undefined,
  options: CaseWorkflowOptions = {}
): OperationalWorkflowEventType[] {
  const workflowSequence = getOperationalWorkflowSequence(options)
  const seen = new Set<OperationalWorkflowEventType>()

  for (const eventType of getSortedOperationalEventTypes(events)) {
    seen.add(eventType)
  }

  return workflowSequence.filter((eventType) => seen.has(eventType))
}

export function getCurrentWorkflowStep(
  events: CaseWorkflowEventLike[] | null | undefined,
  options: CaseWorkflowOptions = {}
): OperationalWorkflowEventType | null {
  const completed = getCompletedOperationalEventTypes(events, options)

  return completed[completed.length - 1] ?? null
}

export function getNextAllowedEventType(
  events: CaseWorkflowEventLike[] | null | undefined,
  options: CaseWorkflowOptions = {}
): OperationalWorkflowEventType | null {
  const workflowSequence = getOperationalWorkflowSequence(options)
  const completed = new Set(getCompletedOperationalEventTypes(events, options))

  for (const eventType of workflowSequence) {
    if (!completed.has(eventType)) {
      return eventType
    }
  }

  return null
}

export function isCaseWorkflowComplete(
  events: CaseWorkflowEventLike[] | null | undefined,
  options: CaseWorkflowOptions = {}
) {
  return isGeneralCaseWorkflow(options)
    ? getCompletedOperationalEventTypes(events, options).includes(CASE_EVENT_TYPES.SCATTERED)
    : getCompletedOperationalEventTypes(events, options).includes(CASE_EVENT_TYPES.RETURNED)
}

export type { CaseWorkflowEventLike, OperationalWorkflowEventType, CaseEventType, CaseWorkflowOptions }
