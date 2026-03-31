create table if not exists public.clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text null,
  address_line_1 text null,
  address_line_2 text null,
  city text null,
  state text null,
  zip text null,
  phone text null,
  email text null,
  logo_path text null,
  logo_alt_text text null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists clinics_name_lower_key
on public.clinics (lower(name));

insert into storage.buckets (id, name, public)
values ('clinic-logos', 'clinic-logos', true)
on conflict (id) do update
set public = excluded.public;
