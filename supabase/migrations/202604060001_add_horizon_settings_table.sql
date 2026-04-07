create table if not exists public.horizon_settings (
  id boolean primary key default true,
  notification_email text null,
  notification_phone text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint horizon_settings_single_row_check check (id = true)
);

alter table public.horizon_settings
add column if not exists notification_sms_phone text null;

insert into public.horizon_settings (
  id,
  notification_email,
  notification_phone
)
values (
  true,
  null,
  null
)
on conflict (id) do nothing;

alter table public.horizon_settings enable row level security;

notify pgrst, 'reload schema';
