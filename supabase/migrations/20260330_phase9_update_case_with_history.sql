drop function if exists public.update_case_with_history(
  uuid,
  uuid,
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
  text
);

create or replace function public.update_case_with_history(
  target_case_id uuid,
  expected_clinic_id uuid,
  changed_by text,
  next_pet_name text,
  next_pet_species text,
  next_pet_weight text,
  next_pet_weight_unit text,
  next_pet_weight_lbs numeric,
  next_pet_breed text,
  next_pet_color text,
  next_owner_name text,
  next_owner_phone text,
  next_owner_email text,
  next_owner_address text,
  next_owner_city text,
  next_owner_state text,
  next_owner_zip text
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
  current_case public.cases%rowtype;
  updated_case public.cases%rowtype;
  previous_data jsonb;
  new_data jsonb;
begin
  select *
  into current_case
  from public.cases
  where public.cases.id = target_case_id
  for update;

  if not found then
    raise exception 'Case not found';
  end if;

  if current_case.clinic_id is distinct from expected_clinic_id then
    raise exception 'Clinic does not own this case';
  end if;

  previous_data := to_jsonb(current_case);

  update public.cases
  set
    pet_name = next_pet_name,
    pet_species = next_pet_species,
    pet_weight = next_pet_weight,
    pet_weight_unit = next_pet_weight_unit,
    pet_weight_lbs = next_pet_weight_lbs,
    pet_breed = next_pet_breed,
    pet_color = next_pet_color,
    owner_name = next_owner_name,
    owner_phone = next_owner_phone,
    owner_email = next_owner_email,
    owner_address = next_owner_address,
    owner_city = next_owner_city,
    owner_state = next_owner_state,
    owner_zip = next_owner_zip,
    case_data = coalesce(current_case.case_data, '{}'::jsonb)
      || jsonb_build_object('case_number', current_case.case_number)
  where public.cases.id = target_case_id
  returning * into updated_case;

  new_data := to_jsonb(updated_case);

  insert into public.case_edit_history (
    case_id,
    case_number,
    clinic_id,
    changed_by,
    change_type,
    previous_data,
    new_data
  )
  values (
    updated_case.id,
    updated_case.case_number,
    updated_case.clinic_id,
    changed_by,
    'clinic_update',
    previous_data,
    new_data
  );

  return query
  select updated_case.id, updated_case.case_number;
end;
$$;

notify pgrst, 'reload schema';
