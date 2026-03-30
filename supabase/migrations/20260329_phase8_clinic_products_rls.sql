alter table public.clinic_products enable row level security;

drop policy if exists "clinic users can read own clinic product overrides" on public.clinic_products;
create policy "clinic users can read own clinic product overrides"
on public.clinic_products
for select
to authenticated
using (
  exists (
    select 1
    from public.clinic_users
    where public.clinic_users.user_id = auth.uid()
      and public.clinic_users.is_active = true
      and public.clinic_users.clinic_id = public.clinic_products.clinic_id
  )
);
