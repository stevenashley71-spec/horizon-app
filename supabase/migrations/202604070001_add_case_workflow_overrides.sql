create table if not exists public.case_workflow_overrides (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  target_step_code text not null,
  reason text not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists case_workflow_overrides_case_id_idx
  on public.case_workflow_overrides (case_id);

create index if not exists case_workflow_overrides_created_at_desc_idx
  on public.case_workflow_overrides (created_at desc);

notify pgrst, 'reload schema';
