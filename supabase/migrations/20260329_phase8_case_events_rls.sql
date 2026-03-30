alter table public.case_events enable row level security;

drop policy if exists "clinic users can read own clinic case events" on public.case_events;
create policy "clinic users can read own clinic case events"
on public.case_events
for select
to authenticated
using (
  exists (
    select 1
    from public.cases
    join public.clinic_users
      on public.clinic_users.clinic_id = public.cases.clinic_id
    where public.clinic_users.user_id = auth.uid()
      and public.clinic_users.is_active = true
      and public.cases.id = public.case_events.case_id
  )
);
