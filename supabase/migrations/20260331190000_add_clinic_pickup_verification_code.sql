alter table public.clinics
add column if not exists pickup_verification_code text null;
