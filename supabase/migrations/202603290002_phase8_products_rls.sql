alter table public.products enable row level security;

drop policy if exists "clinic users can read active products" on public.products;
create policy "clinic users can read active products"
on public.products
for select
to authenticated
using (
  public.products.is_active = true
  and exists (
    select 1
    from public.clinic_users
    where public.clinic_users.user_id = auth.uid()
      and public.clinic_users.is_active = true
  )
);
