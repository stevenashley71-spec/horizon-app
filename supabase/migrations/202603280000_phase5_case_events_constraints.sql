alter table public.case_events
add column if not exists metadata jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'case_events_event_type_check'
  ) then
    alter table public.case_events
    add constraint case_events_event_type_check
    check (
      event_type in (
        'case_created',
        'status_updated',
        'picked_up',
        'received_at_facility',
        'cremation_started',
        'cremation_completed',
        'packaged',
        'returned'
      )
    ) not valid;
  end if;
end $$;

alter table public.case_events
validate constraint case_events_event_type_check;
