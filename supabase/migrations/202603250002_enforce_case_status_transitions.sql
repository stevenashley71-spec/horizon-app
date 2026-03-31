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
  allowed_next_statuses text[];
begin
  select *
  into current_case
  from public.cases
  where public.cases.id = target_case_id
  for update;

  if not found then
    raise exception 'Case not found';
  end if;

  if next_status not in (
    'new',
    'received',
    'in_progress',
    'cremated',
    'ready_for_return',
    'completed',
    'on_hold',
    'cancelled'
  ) then
    raise exception 'Invalid status';
  end if;

  allowed_next_statuses := case current_case.status
    when 'new' then array['received', 'cancelled']
    when 'received' then array['in_progress', 'on_hold', 'cancelled']
    when 'in_progress' then array['cremated', 'on_hold', 'cancelled']
    when 'cremated' then array['ready_for_return']
    when 'ready_for_return' then array['completed']
    when 'on_hold' then array['received', 'in_progress', 'cancelled']
    when 'completed' then array[]::text[]
    when 'cancelled' then array[]::text[]
    else array[]::text[]
  end;

  if current_case.status is not distinct from next_status then
    return query
    select current_case.id, current_case.case_number, current_case.status;
    return;
  end if;

  if not (next_status = any(allowed_next_statuses)) then
    raise exception 'Invalid status transition from % to %', current_case.status, next_status;
  end if;

  update public.cases
  set status = next_status
  where public.cases.id = target_case_id;

  insert into public.case_events (
    case_id,
    case_number,
    event_type,
    created_by,
    metadata
  )
  values (
    current_case.id,
    current_case.case_number,
    'status_updated',
    changed_by,
    '{}'::jsonb
  );

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
