create table if not exists public.case_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  case_number text not null,
  event_type text not null,
  created_at timestamptz not null default timezone('utc', now()),
  created_by text
);

create index if not exists case_events_case_id_created_at_idx
  on public.case_events (case_id, created_at desc);
