create table if not exists public.case_edit_history (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  case_number text not null,
  clinic_id uuid not null references public.clinics(id),
  changed_by text not null,
  changed_at timestamptz not null default timezone('utc', now()),
  change_type text not null,
  previous_data jsonb not null,
  new_data jsonb not null,
  constraint case_edit_history_change_type_check
    check (change_type = 'clinic_update')
);

create index if not exists case_edit_history_case_id_changed_at_idx
  on public.case_edit_history (case_id, changed_at desc);

notify pgrst, 'reload schema';
