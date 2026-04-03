drop function if exists public.create_case_with_initial_event(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  numeric,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text
);

create or replace function public.create_case_with_initial_event(
  clinic_id uuid,
  clinic_name text,
  created_by text,
  pet_name text,
  pet_species text,
  pet_weight text,
  pet_weight_unit text,
  pet_weight_lbs numeric,
  pet_breed text,
  pet_color text,
  owner_name text,
  owner_phone text,
  owner_email text,
  owner_address text,
  owner_city text,
  owner_state text,
  owner_zip text,
  cremation_type text,
  memorial_items jsonb,
  case_data jsonb
)
returns table (
  id uuid,
  case_number text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  generated_case_number text;
  inserted_case public.cases%rowtype;
begin
  select public.generate_case_number() into generated_case_number;

  insert into public.cases (
    clinic_id,
    clinic_name,
    pet_name,
    pet_species,
    pet_weight,
    pet_weight_unit,
    pet_weight_lbs,
    pet_breed,
    pet_color,
    owner_name,
    owner_phone,
    owner_email,
    owner_address,
    owner_city,
    owner_state,
    owner_zip,
    cremation_type,
    selected_urn,
    additional_urns,
    soulburst_items,
    memorial_items,
    subtotal,
    total,
    case_data,
    case_number
  )
  values (
    clinic_id,
    clinic_name,
    pet_name,
    pet_species,
    pet_weight,
    pet_weight_unit,
    pet_weight_lbs,
    pet_breed,
    pet_color,
    owner_name,
    owner_phone,
    owner_email,
    owner_address,
    owner_city,
    owner_state,
    owner_zip,
    cremation_type,
    null,
    '[]'::jsonb,
    '[]'::jsonb,
    coalesce(memorial_items, '[]'::jsonb),
    null,
    null,
    coalesce(case_data, '{}'::jsonb) || jsonb_build_object(
      'clinicId', clinic_id,
      'clinicName', clinic_name,
      'case_number', generated_case_number
    ),
    generated_case_number
  )
  returning * into inserted_case;

  insert into public.case_events (
    case_id,
    case_number,
    event_type,
    created_by,
    metadata
  )
  values (
    inserted_case.id,
    generated_case_number,
    'case_created',
    created_by,
    '{}'::jsonb
  );

  return query
  select inserted_case.id, generated_case_number;
end;
$$;

notify pgrst, 'reload schema';
