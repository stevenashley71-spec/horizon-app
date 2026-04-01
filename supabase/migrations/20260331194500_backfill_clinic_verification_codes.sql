update public.clinics
set pickup_verification_code = 'HPCP-' || upper(substr(md5(gen_random_uuid()::text), 1, 8))
where pickup_verification_code is null
   or btrim(pickup_verification_code) = '';

update public.clinics
set delivery_verification_code = 'HPCD-' || upper(substr(md5(gen_random_uuid()::text), 1, 8))
where delivery_verification_code is null
   or btrim(delivery_verification_code) = '';
