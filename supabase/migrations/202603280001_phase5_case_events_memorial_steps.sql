alter table public.case_events
drop constraint if exists case_events_event_type_check;

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
        'clay_paw_print',
        'nose_print',
        'fur_clipping',
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
