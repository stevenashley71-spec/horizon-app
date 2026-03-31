alter table public.cases enable row level security;

drop policy if exists "clinic users can read own clinic cases" on public.cases;
create policy "clinic users can read own clinic cases"
on public.cases
for select
to authenticated
using (
  exists (
    select 1
    from public.clinic_users
    where public.clinic_users.user_id = auth.uid()
      and public.clinic_users.clinic_id = public.cases.clinic_id
      and public.clinic_users.is_active = true
  )
);

drop policy if exists "clinic users can insert own clinic cases" on public.cases;
create policy "clinic users can insert own clinic cases"
on public.cases
for insert
to authenticated
with check (
  exists (
    select 1
    from public.clinic_users
    where public.clinic_users.user_id = auth.uid()
      and public.clinic_users.clinic_id = public.cases.clinic_id
      and public.clinic_users.is_active = true
  )
);

drop policy if exists "clinic users can update own clinic cases" on public.cases;
create policy "clinic users can update own clinic cases"
on public.cases
for update
to authenticated
using (
  exists (
    select 1
    from public.clinic_users
    where public.clinic_users.user_id = auth.uid()
      and public.clinic_users.clinic_id = public.cases.clinic_id
      and public.clinic_users.is_active = true
  )
)
with check (
  exists (
    select 1
    from public.clinic_users
    where public.clinic_users.user_id = auth.uid()
      and public.clinic_users.clinic_id = public.cases.clinic_id
      and public.clinic_users.is_active = true
  )
);
