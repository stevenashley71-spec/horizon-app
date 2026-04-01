alter table public.clinics
add column if not exists delivery_verification_code text null;
