create policy "users can read own horizon user row"
on public.horizon_users
for select
to authenticated
using (auth.uid() = user_id);
