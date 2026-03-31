alter table public.products
add column if not exists included_by_default boolean not null default false;

create unique index if not exists products_single_included_by_default_idx
on public.products (included_by_default)
where included_by_default = true;
