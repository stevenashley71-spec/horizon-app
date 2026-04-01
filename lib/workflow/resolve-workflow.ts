import 'server-only'

import { createServiceRoleSupabase } from '@/lib/supabase/server'

export type ResolveWorkflowInput = {
  caseId: string
  cremationType: 'private' | 'general'
  events: {
    event_type: string
    created_at: string
  }[]
}

export type ResolveWorkflowResult = {
  currentStep: string | null
  nextStep: string | null
  nextStepCompletionCode: string | null
  isComplete: boolean
  isAtInitialStep: boolean
  allowedNextSteps: string[]
  allowedNextStepDetails: ResolveWorkflowAllowedStep[]
}

export type ResolveWorkflowAllowedStep = {
  code: string
  requiresScan: boolean
}

type InternalWorkflowStepMeta = {
  code: string
  caseEventType: string | null
  isTerminal: boolean
  isInitial: boolean
}

type WorkflowDefinitionRow = {
  id: string
  code: string
  name: string
  version: number
  status: 'draft' | 'active' | 'archived'
}

type WorkflowStepRow = {
  id: string
  workflow_definition_id: string
  code: string
  name: string
  step_type: 'task' | 'scan' | 'intake_gate' | 'status_transition'
  sort_order: number
  required: boolean
  case_event_type: string | null
  completion_scan_code: string | null
  target_case_status: string | null
  intake_section: 'pet' | 'owner' | 'service' | 'products' | 'pricing' | 'signature' | 'validation' | null
}

type WorkflowStepDependencyRow = {
  step_id: string
  depends_on_step_id: string
}

type WorkflowStepRuleRow = {
  workflow_step_id: string
  rule_type: 'cremation_type_in' | 'intake_status_equals' | 'case_status_equals'
  operator: 'equals' | 'in'
  value_json: unknown
}

type WorkflowStepScanRequirementRow = {
  workflow_step_id: string
  scan_entity_type: 'case' | 'remains' | 'package' | 'urn'
  required: boolean
}

type NormalizedStep = WorkflowStepRow & {
  completionEventType: string
  completionScanCode: string | null
  dependencies: string[]
  cremationTypeRules: WorkflowStepRuleRow[]
  scanRequirements: WorkflowStepScanRequirementRow[]
  meta: InternalWorkflowStepMeta
}

function normalizeEventType(value: string | null | undefined) {
  return typeof value === 'string' ? value.trim() : ''
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is string => typeof item === 'string')
}

function stepAllowsCremationType(
  step: Pick<NormalizedStep, 'cremationTypeRules'>,
  cremationType: ResolveWorkflowInput['cremationType']
) {
  const rules = step.cremationTypeRules.filter((rule) => rule.rule_type === 'cremation_type_in')

  if (rules.length === 0) {
    return true
  }

  return rules.every((rule) => {
    if (rule.operator === 'equals') {
      return normalizeEventType(String(rule.value_json)) === cremationType
    }

    if (rule.operator === 'in') {
      return parseStringArray(rule.value_json).includes(cremationType)
    }

    return false
  })
}

function sortEventsAscending(events: ResolveWorkflowInput['events']) {
  return [...events].sort((a, b) => {
    const aTime = new Date(a.created_at).getTime()
    const bTime = new Date(b.created_at).getTime()

    if (!Number.isFinite(aTime) && !Number.isFinite(bTime)) {
      return 0
    }

    if (!Number.isFinite(aTime)) {
      return 1
    }

    if (!Number.isFinite(bTime)) {
      return -1
    }

    return aTime - bTime
  })
}

function dependenciesSatisfied(
  step: NormalizedStep,
  completedStepIds: Set<string>,
  allowedStepIds: Set<string>
) {
  return step.dependencies.every((dependencyStepId) => {
    if (!allowedStepIds.has(dependencyStepId)) {
      return true
    }

    return completedStepIds.has(dependencyStepId)
  })
}

function buildInternalWorkflowStepMeta(
  steps: WorkflowStepRow[],
  dependencyMap: Map<string, string[]>
) {
  const dependedOnStepIds = new Set<string>()

  for (const dependencyStepIds of dependencyMap.values()) {
    for (const dependencyStepId of dependencyStepIds) {
      dependedOnStepIds.add(dependencyStepId)
    }
  }

  return new Map<string, InternalWorkflowStepMeta>(
    steps.map((step) => [
      step.id,
      {
        code: step.code,
        caseEventType: step.case_event_type,
        isTerminal: !dependedOnStepIds.has(step.id),
        isInitial: (dependencyMap.get(step.id) ?? []).length === 0,
      },
    ])
  )
}

export async function resolveWorkflow(
  input: ResolveWorkflowInput
): Promise<ResolveWorkflowResult> {
  if (!input.caseId.trim()) {
    return {
      currentStep: null,
      nextStep: null,
      nextStepCompletionCode: null,
      isComplete: false,
      isAtInitialStep: false,
      allowedNextSteps: [],
      allowedNextStepDetails: [],
    }
  }

  const supabase = createServiceRoleSupabase()

  const { data: workflowDefinitions, error: workflowDefinitionError } = await supabase
    .from('workflow_definitions')
    .select('id, code, name, version, status')
    .eq('status', 'active')
    .order('version', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)

  if (workflowDefinitionError) {
    throw new Error('Unable to load active workflow definition')
  }

  const activeWorkflow = (workflowDefinitions?.[0] ?? null) as WorkflowDefinitionRow | null

  if (!activeWorkflow) {
    return {
      currentStep: null,
      nextStep: null,
      nextStepCompletionCode: null,
      isComplete: false,
      isAtInitialStep: false,
      allowedNextSteps: [],
      allowedNextStepDetails: [],
    }
  }

  const [
    workflowStepsResult,
    workflowStepDependenciesResult,
    workflowStepRulesResult,
    workflowStepScanRequirementsResult,
  ] = await Promise.all([
    supabase
      .from('workflow_steps')
      .select(
        'id, workflow_definition_id, code, name, step_type, sort_order, required, case_event_type, completion_scan_code, target_case_status, intake_section'
      )
      .eq('workflow_definition_id', activeWorkflow.id)
      .order('sort_order', { ascending: true }),
    supabase
      .from('workflow_step_dependencies')
      .select('step_id, depends_on_step_id')
      .eq('workflow_definition_id', activeWorkflow.id),
    supabase
      .from('workflow_step_rules')
      .select('workflow_step_id, rule_type, operator, value_json'),
    supabase
      .from('workflow_step_scan_requirements')
      .select('workflow_step_id, scan_entity_type, required'),
  ])

  if (workflowStepsResult.error) {
    throw new Error('Unable to load workflow steps')
  }

  if (workflowStepDependenciesResult.error) {
    throw new Error('Unable to load workflow step dependencies')
  }

  if (workflowStepRulesResult.error) {
    throw new Error('Unable to load workflow step rules')
  }

  if (workflowStepScanRequirementsResult.error) {
    throw new Error('Unable to load workflow step scan requirements')
  }

  const steps = (workflowStepsResult.data ?? []) as WorkflowStepRow[]
  const stepIds = new Set(steps.map((step) => step.id))

  const dependencyMap = new Map<string, string[]>()

  for (const dependency of (workflowStepDependenciesResult.data ?? []) as WorkflowStepDependencyRow[]) {
    if (!stepIds.has(dependency.step_id) || !stepIds.has(dependency.depends_on_step_id)) {
      continue
    }

    const existingDependencies = dependencyMap.get(dependency.step_id) ?? []
    existingDependencies.push(dependency.depends_on_step_id)
    dependencyMap.set(dependency.step_id, existingDependencies)
  }

  const rulesByStepId = new Map<string, WorkflowStepRuleRow[]>()

  for (const rule of (workflowStepRulesResult.data ?? []) as WorkflowStepRuleRow[]) {
    if (!stepIds.has(rule.workflow_step_id)) {
      continue
    }

    const existingRules = rulesByStepId.get(rule.workflow_step_id) ?? []
    existingRules.push(rule)
    rulesByStepId.set(rule.workflow_step_id, existingRules)
  }

  const scanRequirementsByStepId = new Map<string, WorkflowStepScanRequirementRow[]>()

  for (const scanRequirement of (workflowStepScanRequirementsResult.data ??
    []) as WorkflowStepScanRequirementRow[]) {
    if (!stepIds.has(scanRequirement.workflow_step_id)) {
      continue
    }

    const existingScanRequirements =
      scanRequirementsByStepId.get(scanRequirement.workflow_step_id) ?? []
    existingScanRequirements.push(scanRequirement)
    scanRequirementsByStepId.set(scanRequirement.workflow_step_id, existingScanRequirements)
  }

  const stepMetaById = buildInternalWorkflowStepMeta(steps, dependencyMap)

  const normalizedSteps: NormalizedStep[] = steps.map((step) => ({
    ...step,
    completionEventType: normalizeEventType(step.case_event_type) || step.code,
    completionScanCode: step.completion_scan_code,
    dependencies: dependencyMap.get(step.id) ?? [],
    cremationTypeRules: rulesByStepId.get(step.id) ?? [],
    scanRequirements: scanRequirementsByStepId.get(step.id) ?? [],
    meta: stepMetaById.get(step.id) ?? {
      code: step.code,
      caseEventType: step.case_event_type,
      isTerminal: false,
      isInitial: false,
    },
  }))

  const allowedSteps = normalizedSteps.filter((step) =>
    stepAllowsCremationType(step, input.cremationType)
  )

  const allowedStepIds = new Set(allowedSteps.map((step) => step.id))
  const completedEventTypes = new Set(
    sortEventsAscending(input.events)
      .map((event) => normalizeEventType(event.event_type))
      .filter(Boolean)
  )

  const completedAllowedSteps = allowedSteps.filter((step) =>
    completedEventTypes.has(step.completionEventType)
  )

  const completedAllowedStepIds = new Set(completedAllowedSteps.map((step) => step.id))
  const currentStep = completedAllowedSteps[completedAllowedSteps.length - 1]?.code ?? null

  const remainingAllowedSteps = allowedSteps.filter((step) => !completedAllowedStepIds.has(step.id))

  const allowedNextStepDetails = remainingAllowedSteps
    .filter((step) => dependenciesSatisfied(step, completedAllowedStepIds, allowedStepIds))
    .map((step) => ({
      code: step.code,
      requiresScan: step.scanRequirements.some((requirement) => requirement.required),
    }))

  const allowedNextSteps = allowedNextStepDetails.map((step) => step.code)

  const nextStep = allowedNextSteps[0] ?? null
  // Resolver-owned scan-code contract so consumers do not derive completion codes from step names.
  const nextStepCompletionCode =
    remainingAllowedSteps.find(
      (step) =>
        step.code === nextStep &&
        dependenciesSatisfied(step, completedAllowedStepIds, allowedStepIds)
    )?.completionScanCode ?? null
  const isComplete = remainingAllowedSteps.length === 0
  // Resolver-owned replacement for consumers that previously hardcoded an initial step name.
  // This answers whether the case is currently sitting at an initial workflow step, which for
  // untouched cases means the next actionable step is an initial step.
  const isAtInitialStep =
    !isComplete &&
    allowedSteps.some((step) => step.meta.isInitial && step.code === nextStep)

  return {
    currentStep,
    nextStep,
    nextStepCompletionCode,
    isComplete,
    isAtInitialStep,
    allowedNextSteps,
    allowedNextStepDetails,
  }
}
