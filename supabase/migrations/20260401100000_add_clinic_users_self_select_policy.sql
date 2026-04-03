create policy "users can read own clinic user row"
on public.clinic_users
for select
to authenticated
using (auth.uid() = user_id);
