create table if not exists public.cases (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete restrict,
  clinic_name text not null,
  case_number text not null unique,
  status text not null default 'new',
  created_at timestamptz not null default timezone('utc', now()),
  pet_name text not null,
  pet_species text,
  pet_weight text,
  pet_weight_unit text,
  pet_weight_lbs numeric,
  pet_breed text,
  pet_color text,
  owner_name text not null,
  owner_phone text,
  owner_email text,
  owner_address text,
  owner_city text,
  owner_state text,
  owner_zip text,
  cremation_type text,
  selected_urn text,
  additional_urns jsonb not null default '[]'::jsonb,
  soulburst_items jsonb not null default '[]'::jsonb,
  memorial_items jsonb not null default '[]'::jsonb,
  subtotal numeric,
  total numeric,
  case_data jsonb not null default '{}'::jsonb,
  constraint cases_status_check
    check (
      status in (
        'new',
        'received',
        'in_progress',
        'cremated',
        'ready_for_return',
        'completed',
        'on_hold',
        'cancelled'
      )
    )
);

create index if not exists cases_clinic_id_idx
  on public.cases (clinic_id);

create index if not exists cases_created_at_desc_idx
  on public.cases (created_at desc);
