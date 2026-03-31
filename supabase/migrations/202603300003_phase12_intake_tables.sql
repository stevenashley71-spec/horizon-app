create table if not exists public.intake_drafts (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete restrict,
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  last_updated_by_user_id uuid references auth.users(id) on delete restrict,
  case_id uuid references public.cases(id) on delete set null,
  status text not null default 'draft',
  intake_source text not null default 'clinic_staff',
  locked_for_client_mode boolean not null default false,
  client_mode_started_at timestamptz null,
  submitted_at timestamptz null,
  pet_snapshot jsonb not null default '{}'::jsonb,
  owner_snapshot jsonb not null default '{}'::jsonb,
  service_snapshot jsonb not null default '{}'::jsonb,
  product_snapshot jsonb not null default '[]'::jsonb,
  pricing_snapshot jsonb not null default '{}'::jsonb,
  signature_snapshot jsonb not null default '{}'::jsonb,
  validation_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint intake_drafts_status_check
    check (status in ('draft', 'client_review', 'ready_for_submission', 'submitted', 'abandoned')),
  constraint intake_drafts_intake_source_check
    check (intake_source in ('clinic_staff', 'client_mode'))
);

create table if not exists public.client_mode_sessions (
  id uuid primary key default gen_random_uuid(),
  intake_draft_id uuid not null references public.intake_drafts(id) on delete cascade,
  clinic_id uuid not null references public.clinics(id) on delete restrict,
  started_by_user_id uuid not null references auth.users(id) on delete restrict,
  exited_by_user_id uuid references auth.users(id) on delete restrict,
  status text not null default 'active',
  device_label text null,
  started_at timestamptz not null default timezone('utc', now()),
  exited_at timestamptz null,
  exit_verified_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint client_mode_sessions_status_check
    check (status in ('active', 'exited', 'expired'))
);

create table if not exists public.case_intake_submissions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  intake_draft_id uuid not null references public.intake_drafts(id) on delete restrict,
  clinic_id uuid not null references public.clinics(id) on delete restrict,
  submitted_by_user_id uuid not null references auth.users(id) on delete restrict,
  pet_snapshot jsonb not null,
  owner_snapshot jsonb not null,
  service_snapshot jsonb not null,
  product_snapshot jsonb not null,
  pricing_snapshot jsonb not null,
  signature_snapshot jsonb not null,
  submitted_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists intake_drafts_clinic_id_idx
  on public.intake_drafts (clinic_id);

create index if not exists intake_drafts_status_idx
  on public.intake_drafts (status);

create index if not exists intake_drafts_created_at_desc_idx
  on public.intake_drafts (created_at desc);

create index if not exists intake_drafts_case_id_idx
  on public.intake_drafts (case_id);

create index if not exists client_mode_sessions_clinic_id_idx
  on public.client_mode_sessions (clinic_id);

create index if not exists client_mode_sessions_intake_draft_id_idx
  on public.client_mode_sessions (intake_draft_id);

create index if not exists case_intake_submissions_clinic_id_idx
  on public.case_intake_submissions (clinic_id);

create index if not exists case_intake_submissions_case_id_idx
  on public.case_intake_submissions (case_id);

create index if not exists case_intake_submissions_intake_draft_id_idx
  on public.case_intake_submissions (intake_draft_id);

create or replace function public.set_intake_drafts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_intake_drafts_updated_at on public.intake_drafts;

create trigger set_intake_drafts_updated_at
before update on public.intake_drafts
for each row
execute function public.set_intake_drafts_updated_at();

notify pgrst, 'reload schema';
