create table if not exists public.case_status_history (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  case_number text not null,
  previous_status text,
  new_status text not null,
  changed_at timestamptz not null default timezone('utc', now()),
  changed_by text
);

create index if not exists case_status_history_case_id_changed_at_idx
  on public.case_status_history (case_id, changed_at desc);

drop function if exists public.update_case_status_with_history(uuid, text);
drop function if exists public.update_case_status_with_history(uuid, text, text);

create or replace function public.update_case_status_with_history(
  target_case_id uuid,
  next_status text,
  changed_by text
)
returns table (
  id uuid,
  case_number text,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_case public.cases%rowtype;
begin
  select *
  into current_case
  from public.cases
  where public.cases.id = target_case_id
  for update;

  if not found then
    raise exception 'Case not found';
  end if;

  if current_case.status is not distinct from next_status then
    return query
    select current_case.id, current_case.case_number, current_case.status;
    return;
  end if;

  update public.cases
  set status = next_status
  where public.cases.id = target_case_id;

  insert into public.case_status_history (
    case_id,
    case_number,
    previous_status,
    new_status,
    changed_by
  )
  values (
    current_case.id,
    current_case.case_number,
    current_case.status,
    next_status,
    changed_by
  );

  return query
  select public.cases.id, public.cases.case_number, public.cases.status
  from public.cases
  where public.cases.id = target_case_id;
end;
$$;

notify pgrst, 'reload schema';
