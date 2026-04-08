import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { AdminSectionShell } from '../admin-section-shell'
import { getTemporaryHorizonAdminResult, requireTemporaryHorizonAdmin } from '@/lib/admin-auth'
import { createServiceRoleSupabase } from '@/lib/supabase/server'

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
  sort_order: number
  code: string
  name: string
  required: boolean
  case_event_type: string | null
  target_case_status: string | null
}

type WorkflowStepDependencyRow = {
  step_id: string
  depends_on_step_id: string
}

type WorkflowStepRuleRow = {
  id: string
  workflow_step_id: string
  rule_type: string
  operator: 'equals' | 'in'
  value_json: unknown
}

function getMemorialRuleMatch(value: unknown) {
  if (!value || typeof value !== 'object') {
    return ''
  }

  const match = (value as { match?: unknown }).match
  return typeof match === 'string' ? match : ''
}

export default async function WorkflowAdminPage() {
  const adminResult = await getTemporaryHorizonAdminResult()

  if (!adminResult) {
    redirect('/admin/login')
  }

  if (adminResult.kind === 'blocked') {
    return (
      <div className="mx-auto max-w-5xl">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
          Workflow
        </h1>
        <p className="mt-3 text-xl text-slate-500">{adminResult.message}</p>
      </div>
    )
  }

  const supabase = createServiceRoleSupabase()
  const { data: workflowDefinitions, error: workflowDefinitionsError } = await supabase
    .from('workflow_definitions')
    .select('id, code, name, version, status')
    .eq('status', 'active')
    .order('version', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)

  if (workflowDefinitionsError) {
    throw new Error(workflowDefinitionsError.message)
  }

  const activeWorkflow = ((workflowDefinitions ?? [])[0] ?? null) as WorkflowDefinitionRow | null

  if (!activeWorkflow) {
    return (
      <AdminSectionShell>
        <section className="rounded-[28px] bg-white p-8 shadow-sm">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
              Workflow
            </h1>
            <p className="mt-3 text-xl text-slate-500">
              View the active production workflow definition and ordered step structure.
            </p>
          </div>
        </section>

        <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-slate-600">No active workflow definition is currently configured.</p>
        </section>
      </AdminSectionShell>
    )
  }

  const currentWorkflow = activeWorkflow

  const [{ data: workflowSteps, error: workflowStepsError }, { data: workflowDependencies, error: workflowDependenciesError }] =
    await Promise.all([
      supabase
        .from('workflow_steps')
        .select('id, workflow_definition_id, sort_order, code, name, required, case_event_type, target_case_status')
        .eq('workflow_definition_id', currentWorkflow.id)
        .order('sort_order', { ascending: true }),
      supabase
        .from('workflow_step_dependencies')
        .select('step_id, depends_on_step_id')
        .eq('workflow_definition_id', currentWorkflow.id),
    ])

  if (workflowStepsError) {
    throw new Error(workflowStepsError.message)
  }

  if (workflowDependenciesError) {
    throw new Error(workflowDependenciesError.message)
  }

  const stepItems = (workflowSteps as WorkflowStepRow[] | null) ?? []
  const stepIds = stepItems.map((step) => step.id)
  const { data: workflowRules, error: workflowRulesError } = stepIds.length
    ? await supabase
        .from('workflow_step_rules')
        .select('id, workflow_step_id, rule_type, operator, value_json')
        .in('workflow_step_id', stepIds)
    : { data: [], error: null }

  if (workflowRulesError) {
    throw new Error(workflowRulesError.message)
  }

  const dependencyItems = (workflowDependencies as WorkflowStepDependencyRow[] | null) ?? []
  const ruleItems = (workflowRules as WorkflowStepRuleRow[] | null) ?? []
  const stepCodeById = new Map(stepItems.map((step) => [step.id, step.code]))
  const dependencyCodesByStepId = new Map<string, string[]>()
  const rulesByStepId = new Map<string, WorkflowStepRuleRow[]>()

  for (const dependency of dependencyItems) {
    const dependencyCode = stepCodeById.get(dependency.depends_on_step_id)

    if (!dependencyCode) {
      continue
    }

    const existingDependencyCodes = dependencyCodesByStepId.get(dependency.step_id) ?? []
    existingDependencyCodes.push(dependencyCode)
    dependencyCodesByStepId.set(dependency.step_id, existingDependencyCodes)
  }

  for (const rule of ruleItems) {
    const existingRules = rulesByStepId.get(rule.workflow_step_id) ?? []
    existingRules.push(rule)
    rulesByStepId.set(rule.workflow_step_id, existingRules)
  }

  async function moveStep(stepId: string, adjacentStepId: string) {
    'use server'

    await requireTemporaryHorizonAdmin()

    const actionSupabase = createServiceRoleSupabase()
    const { data: stepsToSwap, error: stepsToSwapError } = await actionSupabase
      .from('workflow_steps')
      .select('id, workflow_definition_id, sort_order')
      .in('id', [stepId, adjacentStepId])
      .eq('workflow_definition_id', currentWorkflow.id)

    if (stepsToSwapError) {
      throw new Error(stepsToSwapError.message)
    }

    if (!stepsToSwap || stepsToSwap.length !== 2) {
      throw new Error('Unable to load workflow steps for reorder.')
    }

    const currentStep = stepsToSwap.find((step) => step.id === stepId)
    const adjacentStep = stepsToSwap.find((step) => step.id === adjacentStepId)

    if (!currentStep || !adjacentStep) {
      throw new Error('Unable to resolve workflow step reorder.')
    }

    const temporarySortOrder =
      Math.min(currentStep.sort_order, adjacentStep.sort_order) - stepItems.length - 1000

    const { error: moveCurrentToTemporaryError } = await actionSupabase
      .from('workflow_steps')
      .update({ sort_order: temporarySortOrder })
      .eq('id', currentStep.id)
      .eq('workflow_definition_id', currentWorkflow.id)

    if (moveCurrentToTemporaryError) {
      throw new Error(moveCurrentToTemporaryError.message)
    }

    const { error: moveAdjacentError } = await actionSupabase
      .from('workflow_steps')
      .update({ sort_order: currentStep.sort_order })
      .eq('id', adjacentStep.id)
      .eq('workflow_definition_id', currentWorkflow.id)

    if (moveAdjacentError) {
      throw new Error(moveAdjacentError.message)
    }

    const { error: moveCurrentIntoPlaceError } = await actionSupabase
      .from('workflow_steps')
      .update({ sort_order: adjacentStep.sort_order })
      .eq('id', currentStep.id)
      .eq('workflow_definition_id', currentWorkflow.id)

    if (moveCurrentIntoPlaceError) {
      throw new Error(moveCurrentIntoPlaceError.message)
    }

    revalidatePath('/admin/workflow')
  }

  async function createStep(formData: FormData) {
    'use server'

    await requireTemporaryHorizonAdmin()

    const name = String(formData.get('name') ?? '').trim()
    const code = String(formData.get('code') ?? '').trim().toLowerCase()
    const caseEventTypeValue = String(formData.get('case_event_type') ?? '').trim()
    const targetCaseStatusValue = String(formData.get('target_case_status') ?? '').trim()

    if (!name) {
      throw new Error('Step name is required.')
    }

    if (!code) {
      throw new Error('Step code is required.')
    }

    if (!/^[a-z0-9_]+$/.test(code)) {
      throw new Error('Step code must be lowercase snake_case.')
    }

    const actionSupabase = createServiceRoleSupabase()
    const { data: existingStep, error: existingStepError } = await actionSupabase
      .from('workflow_steps')
      .select('id')
      .eq('workflow_definition_id', currentWorkflow.id)
      .eq('code', code)
      .maybeSingle()

    if (existingStepError) {
      throw new Error(existingStepError.message)
    }

    if (existingStep) {
      throw new Error('A workflow step with that code already exists.')
    }

    const { data: maxSortOrderRow, error: maxSortOrderError } = await actionSupabase
      .from('workflow_steps')
      .select('sort_order')
      .eq('workflow_definition_id', currentWorkflow.id)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (maxSortOrderError) {
      throw new Error(maxSortOrderError.message)
    }

    const nextSortOrder =
      typeof maxSortOrderRow?.sort_order === 'number' ? maxSortOrderRow.sort_order + 1 : 1

    const { error: insertStepError } = await actionSupabase
      .from('workflow_steps')
      .insert({
        workflow_definition_id: currentWorkflow.id,
        name,
        code,
        case_event_type: caseEventTypeValue || null,
        target_case_status: targetCaseStatusValue || null,
        sort_order: nextSortOrder,
        step_type: 'task',
        required: false,
      })

    if (insertStepError) {
      throw new Error(insertStepError.message)
    }

    revalidatePath('/admin/workflow')
  }

  async function saveDependencies(formData: FormData) {
    'use server'

    await requireTemporaryHorizonAdmin()

    const stepId = String(formData.get('step_id') ?? '').trim()

    if (!stepId) {
      throw new Error('Workflow step is required.')
    }

    const actionSupabase = createServiceRoleSupabase()
    const { data: currentStep, error: currentStepError } = await actionSupabase
      .from('workflow_steps')
      .select('id, workflow_definition_id, sort_order')
      .eq('id', stepId)
      .eq('workflow_definition_id', currentWorkflow.id)
      .maybeSingle()

    if (currentStepError) {
      throw new Error(currentStepError.message)
    }

    if (!currentStep) {
      throw new Error('Workflow step not found.')
    }

    const selectedDependencyIds = Array.from(formData.entries())
      .filter(([key, value]) => key === 'dependency_step_id' && typeof value === 'string')
      .map(([, value]) => String(value).trim())
      .filter(Boolean)

    const uniqueDependencyIds = [...new Set(selectedDependencyIds)]
    const validDependencyIds = new Set(
      stepItems
        .filter((step) => step.id !== currentStep.id && step.sort_order < currentStep.sort_order)
        .map((step) => step.id)
    )

    for (const dependencyStepId of uniqueDependencyIds) {
      if (!validDependencyIds.has(dependencyStepId)) {
        throw new Error('Invalid dependency selection.')
      }
    }

    const { error: deleteDependenciesError } = await actionSupabase
      .from('workflow_step_dependencies')
      .delete()
      .eq('workflow_definition_id', currentWorkflow.id)
      .eq('step_id', currentStep.id)

    if (deleteDependenciesError) {
      throw new Error(deleteDependenciesError.message)
    }

    if (uniqueDependencyIds.length > 0) {
      const { error: insertDependenciesError } = await actionSupabase
        .from('workflow_step_dependencies')
        .insert(
          uniqueDependencyIds.map((dependencyStepId) => ({
            workflow_definition_id: currentWorkflow.id,
            step_id: currentStep.id,
            depends_on_step_id: dependencyStepId,
            dependency_type: 'completion',
          }))
        )

      if (insertDependenciesError) {
        throw new Error(insertDependenciesError.message)
      }
    }

    revalidatePath('/admin/workflow')
  }

  async function saveCondition(formData: FormData) {
    'use server'

    await requireTemporaryHorizonAdmin()

    const stepId = String(formData.get('step_id') ?? '').trim()
    const match = String(formData.get('condition_match') ?? '').trim()

    if (!stepId) {
      throw new Error('Workflow step is required.')
    }

    const actionSupabase = createServiceRoleSupabase()
    const { data: currentStep, error: currentStepError } = await actionSupabase
      .from('workflow_steps')
      .select('id')
      .eq('id', stepId)
      .eq('workflow_definition_id', currentWorkflow.id)
      .maybeSingle()

    if (currentStepError) {
      throw new Error(currentStepError.message)
    }

    if (!currentStep) {
      throw new Error('Workflow step not found.')
    }

    if (!match) {
      const { error: deleteRuleError } = await actionSupabase
        .from('workflow_step_rules')
        .delete()
        .eq('workflow_step_id', stepId)
        .eq('rule_type', 'memorial_name_contains')

      if (deleteRuleError) {
        throw new Error(deleteRuleError.message)
      }

      revalidatePath('/admin/workflow')
      return
    }

    const { data: existingRules, error: existingRulesError } = await actionSupabase
      .from('workflow_step_rules')
      .select('id')
      .eq('workflow_step_id', stepId)
      .eq('rule_type', 'memorial_name_contains')

    if (existingRulesError) {
      throw new Error(existingRulesError.message)
    }

    if ((existingRules ?? []).length > 0) {
      const { error: updateRuleError } = await actionSupabase
        .from('workflow_step_rules')
        .update({
          operator: 'equals',
          value_json: { match },
        })
        .eq('workflow_step_id', stepId)
        .eq('rule_type', 'memorial_name_contains')

      if (updateRuleError) {
        throw new Error(updateRuleError.message)
      }
    } else {
      const { error: insertRuleError } = await actionSupabase
        .from('workflow_step_rules')
        .insert({
          workflow_step_id: stepId,
          rule_type: 'memorial_name_contains',
          operator: 'equals',
          value_json: { match },
        })

      if (insertRuleError) {
        throw new Error(insertRuleError.message)
      }
    }

    revalidatePath('/admin/workflow')
  }

  async function setStepRequired(formData: FormData) {
    'use server'

    await requireTemporaryHorizonAdmin()

    const stepId = String(formData.get('step_id') ?? '').trim()
    const requiredValue = String(formData.get('required') ?? '').trim()

    if (!stepId) {
      throw new Error('Workflow step is required.')
    }

    const actionSupabase = createServiceRoleSupabase()
    const { error: updateRequiredError } = await actionSupabase
      .from('workflow_steps')
      .update({
        required: requiredValue === 'true',
      })
      .eq('id', stepId)
      .eq('workflow_definition_id', currentWorkflow.id)

    if (updateRequiredError) {
      throw new Error(updateRequiredError.message)
    }

    revalidatePath('/admin/workflow')
  }

  return (
    <AdminSectionShell>
      <section className="rounded-[28px] bg-white p-8 shadow-sm">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
            Workflow
          </h1>
          <p className="mt-3 text-xl text-slate-500">
            View the active production workflow definition and ordered step structure.
          </p>
        </div>
      </section>

      <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Active Workflow</h2>
          <p className="mt-1 text-sm text-slate-500">
            Current active workflow definition used by the resolver.
          </p>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <div>
            <div className="text-sm font-medium text-slate-500">Workflow Name</div>
            <div className="mt-1 text-lg font-semibold text-slate-900">{currentWorkflow.name}</div>
          </div>
          <div>
            <div className="text-sm font-medium text-slate-500">Workflow Code</div>
            <div className="mt-1 text-lg font-semibold text-slate-900">{currentWorkflow.code}</div>
          </div>
          <div>
            <div className="text-sm font-medium text-slate-500">Version</div>
            <div className="mt-1 text-lg font-semibold text-slate-900">{currentWorkflow.version}</div>
          </div>
          <div>
            <div className="text-sm font-medium text-slate-500">Status</div>
            <div className="mt-1 text-lg font-semibold text-slate-900">{currentWorkflow.status}</div>
          </div>
        </div>
      </section>

      <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Create Step</h2>
          <p className="mt-1 text-sm text-slate-500">
            Add a new workflow step to the bottom of the active workflow.
          </p>
        </div>

        <form action={createStep} className="mt-6 grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="workflow-step-name" className="mb-2 block text-sm font-medium text-slate-600">
              Step Name
            </label>
            <input
              id="workflow-step-name"
              name="name"
              type="text"
              required
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
            />
          </div>
          <div>
            <label htmlFor="workflow-step-code" className="mb-2 block text-sm font-medium text-slate-600">
              Code
            </label>
            <input
              id="workflow-step-code"
              name="code"
              type="text"
              required
              pattern="[a-z0-9_]+"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
            />
          </div>
          <div>
            <label htmlFor="workflow-step-event-type" className="mb-2 block text-sm font-medium text-slate-600">
              Event Type
            </label>
            <input
              id="workflow-step-event-type"
              name="case_event_type"
              type="text"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
            />
          </div>
          <div>
            <label htmlFor="workflow-step-target-status" className="mb-2 block text-sm font-medium text-slate-600">
              Target Status
            </label>
            <input
              id="workflow-step-target-status"
              name="target_case_status"
              type="text"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
            />
          </div>
          <div className="md:col-span-2">
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-4 py-3 font-medium text-white hover:bg-slate-800"
            >
              Add Step
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-[24px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5">
          <h2 className="text-2xl font-semibold text-slate-900">Ordered Workflow Steps</h2>
          <p className="mt-1 text-sm text-slate-500">
            Steps are shown in ascending `sort_order` with dependency step codes.
          </p>
        </div>

        {stepItems.length === 0 ? (
          <div className="p-6">
            <p className="text-slate-600">No workflow steps exist for the active workflow.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead className="bg-slate-50">
                <tr className="text-left">
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600">Order</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600">Step Name</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600">Code</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600">Active</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600">Event Type</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600">Target Status</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600">Dependencies</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {stepItems.map((step, index) => {
                  const dependencyCodes = dependencyCodesByStepId.get(step.id) ?? []
                  const previousStep = index > 0 ? stepItems[index - 1] : null
                  const nextStep = index < stepItems.length - 1 ? stepItems[index + 1] : null
                  const availableDependencySteps = stepItems.filter(
                    (candidateStep) =>
                      candidateStep.id !== step.id && candidateStep.sort_order < step.sort_order
                  )
                  const selectedDependencyIds = new Set(
                    dependencyItems
                      .filter((dependency) => dependency.step_id === step.id)
                      .map((dependency) => dependency.depends_on_step_id)
                  )
                  const memorialConditionRule =
                    (rulesByStepId.get(step.id) ?? []).find(
                      (rule) => rule.rule_type === 'memorial_name_contains'
                    ) ?? null

                  return (
                    <tr key={step.id} className="border-t border-slate-200 align-top">
                      <td className="px-6 py-4 text-sm text-slate-900">{step.sort_order}</td>
                      <td className="px-6 py-4 text-sm text-slate-900">{step.name}</td>
                      <td className="px-6 py-4 text-sm text-slate-700">{step.code}</td>
                      <td className="px-6 py-4 text-sm text-slate-700">
                        <form action={setStepRequired}>
                          <input type="hidden" name="step_id" value={step.id} />
                          <input type="hidden" name="required" value={step.required ? 'false' : 'true'} />
                          <button
                            type="submit"
                            aria-pressed={step.required}
                            className={`inline-flex items-center rounded-full px-3 py-1 font-medium ${
                              step.required
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            <span
                              className={`mr-2 inline-block h-2.5 w-2.5 rounded-full ${
                                step.required ? 'bg-emerald-600' : 'bg-slate-500'
                              }`}
                            />
                            {step.required ? 'Active' : 'Inactive'}
                          </button>
                        </form>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700">
                        {step.case_event_type || '—'}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700">
                        {step.target_case_status || '—'}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700">
                        <div className="space-y-3">
                          <div>{dependencyCodes.length > 0 ? dependencyCodes.join(', ') : '—'}</div>
                          <details className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <summary className="cursor-pointer list-none text-sm font-medium text-slate-700">
                              Edit Dependencies
                            </summary>
                            <form action={saveDependencies} className="mt-3 space-y-3">
                              <input type="hidden" name="step_id" value={step.id} />
                              {availableDependencySteps.length === 0 ? (
                                <p className="text-sm text-slate-500">
                                  No earlier steps are available as dependencies.
                                </p>
                              ) : (
                                <div className="space-y-2">
                                  {availableDependencySteps.map((candidateStep) => (
                                    <label
                                      key={candidateStep.id}
                                      className="flex items-center gap-3 text-sm text-slate-700"
                                    >
                                      <input
                                        type="checkbox"
                                        name="dependency_step_id"
                                        value={candidateStep.id}
                                        defaultChecked={selectedDependencyIds.has(candidateStep.id)}
                                        className="h-4 w-4 rounded border-slate-300 text-slate-900"
                                      />
                                      <span>
                                        {candidateStep.name} ({candidateStep.code})
                                      </span>
                                    </label>
                                  ))}
                                </div>
                              )}
                              <button
                                type="submit"
                                className="rounded-lg bg-slate-900 px-3 py-2 font-medium text-white hover:bg-slate-800"
                              >
                                Save Dependencies
                              </button>
                            </form>
                          </details>
                          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <div className="text-sm font-medium text-slate-700">
                              Conditional Rule
                            </div>
                            <form action={saveCondition} className="mt-3 space-y-3">
                              <input type="hidden" name="step_id" value={step.id} />
                              <div>
                                <label
                                  htmlFor={`condition-match-${step.id}`}
                                  className="mb-2 block text-sm font-medium text-slate-600"
                                >
                                  Required if memorial name contains
                                </label>
                                <input
                                  id={`condition-match-${step.id}`}
                                  name="condition_match"
                                  type="text"
                                  defaultValue={getMemorialRuleMatch(
                                    memorialConditionRule?.value_json
                                  )}
                                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
                                />
                              </div>
                              <button
                                type="submit"
                                className="rounded-lg bg-slate-900 px-3 py-2 font-medium text-white hover:bg-slate-800"
                              >
                                Save Condition
                              </button>
                            </form>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700">
                        <div className="flex flex-wrap gap-2">
                          <form
                            action={async () => {
                              'use server'

                              if (!previousStep) {
                                return
                              }

                              await moveStep(step.id, previousStep.id)
                            }}
                          >
                            <button
                              type="submit"
                              disabled={!previousStep}
                              className="rounded-lg bg-slate-100 px-3 py-2 font-medium text-slate-700 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Up
                            </button>
                          </form>
                          <form
                            action={async () => {
                              'use server'

                              if (!nextStep) {
                                return
                              }

                              await moveStep(step.id, nextStep.id)
                            }}
                          >
                            <button
                              type="submit"
                              disabled={!nextStep}
                              className="rounded-lg bg-slate-100 px-3 py-2 font-medium text-slate-700 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Down
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AdminSectionShell>
  )
}
