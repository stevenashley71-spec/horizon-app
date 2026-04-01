-- Suggested filename: 202603310001_phase14_dynamic_workflow_engine.sql

create table if not exists public.workflow_definitions (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  version integer not null,
  status text not null default 'draft',
  applies_to_cremation_type text not null default 'all',
  description text null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint workflow_definitions_status_check
    check (status in ('draft', 'active', 'archived')),
  constraint workflow_definitions_applies_to_cremation_type_check
    check (applies_to_cremation_type in ('all', 'private', 'general')),
  constraint workflow_definitions_code_version_key
    unique (code, version)
);

create table if not exists public.workflow_steps (
  id uuid primary key default gen_random_uuid(),
  workflow_definition_id uuid not null references public.workflow_definitions(id) on delete cascade,
  code text not null,
  name text not null,
  step_type text not null default 'task',
  sort_order integer not null,
  required boolean not null default true,
  case_event_type text null,
  target_case_status text null,
  intake_section text null,
  description text null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint workflow_steps_step_type_check
    check (step_type in ('task', 'scan', 'intake_gate', 'status_transition')),
  constraint workflow_steps_intake_section_check
    check (
      intake_section is null
      or intake_section in ('pet', 'owner', 'service', 'products', 'pricing', 'signature', 'validation')
    ),
  constraint workflow_steps_workflow_definition_id_code_key
    unique (workflow_definition_id, code),
  constraint workflow_steps_workflow_definition_id_sort_order_key
    unique (workflow_definition_id, sort_order)
);

create table if not exists public.workflow_step_dependencies (
  id uuid primary key default gen_random_uuid(),
  workflow_definition_id uuid not null references public.workflow_definitions(id) on delete cascade,
  step_id uuid not null references public.workflow_steps(id) on delete cascade,
  depends_on_step_id uuid not null references public.workflow_steps(id) on delete cascade,
  dependency_type text not null default 'completion',
  created_at timestamptz not null default timezone('utc'::text, now()),
  constraint workflow_step_dependencies_dependency_type_check
    check (dependency_type in ('completion')),
  constraint workflow_step_dependencies_not_self_check
    check (step_id <> depends_on_step_id),
  constraint workflow_step_dependencies_step_id_depends_on_step_id_key
    unique (step_id, depends_on_step_id)
);

create table if not exists public.workflow_step_rules (
  id uuid primary key default gen_random_uuid(),
  workflow_step_id uuid not null references public.workflow_steps(id) on delete cascade,
  rule_type text not null,
  operator text not null default 'equals',
  value_json jsonb not null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  constraint workflow_step_rules_rule_type_check
    check (rule_type in ('cremation_type_in', 'intake_status_equals', 'case_status_equals')),
  constraint workflow_step_rules_operator_check
    check (operator in ('equals', 'in'))
);

create table if not exists public.workflow_step_scan_requirements (
  id uuid primary key default gen_random_uuid(),
  workflow_step_id uuid not null references public.workflow_steps(id) on delete cascade,
  scan_entity_type text not null,
  required boolean not null default true,
  created_at timestamptz not null default timezone('utc'::text, now()),
  constraint workflow_step_scan_requirements_scan_entity_type_check
    check (scan_entity_type in ('case', 'remains', 'package', 'urn')),
  constraint workflow_step_scan_requirements_workflow_step_id_scan_entity_type_key
    unique (workflow_step_id, scan_entity_type)
);

create table if not exists public.case_workflow_instances (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  workflow_definition_id uuid not null references public.workflow_definitions(id) on delete restrict,
  workflow_code_snapshot text not null,
  workflow_name_snapshot text not null,
  workflow_version_snapshot integer not null,
  applies_to_cremation_type_snapshot text not null,
  status text not null default 'active',
  started_at timestamptz not null default timezone('utc'::text, now()),
  completed_at timestamptz null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  constraint case_workflow_instances_applies_to_cremation_type_snapshot_check
    check (applies_to_cremation_type_snapshot in ('all', 'private', 'general')),
  constraint case_workflow_instances_status_check
    check (status in ('active', 'completed', 'cancelled')),
  constraint case_workflow_instances_case_id_key
    unique (case_id)
);

create table if not exists public.case_workflow_step_instances (
  id uuid primary key default gen_random_uuid(),
  case_workflow_instance_id uuid not null references public.case_workflow_instances(id) on delete cascade,
  workflow_step_id uuid not null references public.workflow_steps(id) on delete restrict,
  step_code_snapshot text not null,
  step_name_snapshot text not null,
  step_type_snapshot text not null,
  sort_order_snapshot integer not null,
  required_snapshot boolean not null,
  case_event_type_snapshot text null,
  target_case_status_snapshot text null,
  intake_section_snapshot text null,
  status text not null default 'pending',
  blocked_reason text null,
  completed_at timestamptz null,
  completion_source text null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint case_workflow_step_instances_status_check
    check (status in ('pending', 'available', 'completed', 'skipped', 'blocked')),
  constraint case_workflow_step_instances_completion_source_check
    check (completion_source is null or completion_source in ('case_event', 'intake_progress', 'manual', 'scan')),
  constraint case_workflow_step_instances_case_workflow_instance_id_workflow_step_id_key
    unique (case_workflow_instance_id, workflow_step_id),
  constraint case_workflow_step_instances_case_workflow_instance_id_step_code_snapshot_key
    unique (case_workflow_instance_id, step_code_snapshot)
);

create index if not exists workflow_definitions_status_idx
  on public.workflow_definitions (status);

create index if not exists workflow_definitions_applies_to_cremation_type_idx
  on public.workflow_definitions (applies_to_cremation_type);

create index if not exists workflow_steps_workflow_definition_id_idx
  on public.workflow_steps (workflow_definition_id);

create index if not exists workflow_steps_workflow_definition_id_sort_order_idx
  on public.workflow_steps (workflow_definition_id, sort_order);

create index if not exists workflow_steps_case_event_type_idx
  on public.workflow_steps (case_event_type);

create index if not exists workflow_steps_target_case_status_idx
  on public.workflow_steps (target_case_status);

create index if not exists workflow_step_dependencies_workflow_definition_id_idx
  on public.workflow_step_dependencies (workflow_definition_id);

create index if not exists workflow_step_dependencies_step_id_idx
  on public.workflow_step_dependencies (step_id);

create index if not exists workflow_step_dependencies_depends_on_step_id_idx
  on public.workflow_step_dependencies (depends_on_step_id);

create index if not exists workflow_step_rules_workflow_step_id_idx
  on public.workflow_step_rules (workflow_step_id);

create index if not exists workflow_step_rules_rule_type_idx
  on public.workflow_step_rules (rule_type);

create index if not exists workflow_step_scan_requirements_workflow_step_id_idx
  on public.workflow_step_scan_requirements (workflow_step_id);

create index if not exists case_workflow_instances_workflow_definition_id_idx
  on public.case_workflow_instances (workflow_definition_id);

create index if not exists case_workflow_instances_status_idx
  on public.case_workflow_instances (status);

create index if not exists case_workflow_step_instances_case_workflow_instance_id_idx
  on public.case_workflow_step_instances (case_workflow_instance_id);

create index if not exists case_workflow_step_instances_case_workflow_instance_id_status_sort_order_snapshot_idx
  on public.case_workflow_step_instances (case_workflow_instance_id, status, sort_order_snapshot);

create index if not exists case_workflow_step_instances_workflow_step_id_idx
  on public.case_workflow_step_instances (workflow_step_id);

create index if not exists case_workflow_step_instances_case_event_type_snapshot_idx
  on public.case_workflow_step_instances (case_event_type_snapshot);

notify pgrst, 'reload schema';
