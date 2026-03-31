create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  description text null,
  base_price numeric(10,2) not null,
  image_path text null,
  image_alt_text text null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists products_name_lower_key
on public.products (lower(name));

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update
set public = excluded.public;
