create table if not exists public.horizon_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint horizon_users_role_check
    check (role in ('admin', 'horizon_staff')),
  constraint horizon_users_user_id_key
    unique (user_id)
);

create index if not exists horizon_users_role_is_active_idx
on public.horizon_users (role, is_active);
