alter table public.products
add column if not exists horizon_invoice_price numeric(10,2) null;

alter table public.clinic_products
add column if not exists horizon_invoice_price_override numeric(10,2) null;

alter table public.clinic_products
add column if not exists included_in_cremation boolean null;

create table if not exists public.cremation_pricing (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid null references public.clinics(id) on delete cascade,
  cremation_type text not null check (cremation_type in ('private', 'general')),
  weight_min_lbs numeric null,
  weight_max_lbs numeric null,
  client_price numeric(10,2) null,
  horizon_invoice_price numeric(10,2) null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    weight_min_lbs is null
    or weight_max_lbs is null
    or weight_min_lbs <= weight_max_lbs
  )
);

create index if not exists cremation_pricing_clinic_id_cremation_type_idx
on public.cremation_pricing (clinic_id, cremation_type);
