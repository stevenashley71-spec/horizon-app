drop extension if exists "pg_net";

alter table "public"."cases" drop constraint "cases_case_number_key";

alter table "public"."cases" drop constraint "cases_status_check";

alter table "public"."clinic_products" drop constraint "clinic_products_pkey";

drop index if exists "public"."clinic_products_pkey";


  create table "public"."case_sequences" (
    "year" integer not null,
    "last_number" integer not null default 0
      );


alter table "public"."case_events" alter column "created_at" set default now();

alter table "public"."case_status_history" alter column "changed_at" set default now();

alter table "public"."cases" alter column "additional_urns" drop not null;

alter table "public"."cases" alter column "case_data" drop not null;

alter table "public"."cases" alter column "clinic_name" drop not null;

alter table "public"."cases" alter column "created_at" set default now();

alter table "public"."cases" alter column "created_at" drop not null;

alter table "public"."cases" alter column "memorial_items" drop not null;

alter table "public"."cases" alter column "owner_name" drop not null;

alter table "public"."cases" alter column "pet_name" drop not null;

alter table "public"."cases" alter column "soulburst_items" drop not null;

alter table "public"."cases" alter column "status" drop not null;

alter table "public"."clinic_products" drop column "created_at";

alter table "public"."clinic_products" drop column "id";

alter table "public"."clinic_products" drop column "updated_at";

alter table "public"."clinic_users" drop column "updated_at";

alter table "public"."clinics" drop column "address_line_1";

alter table "public"."clinics" drop column "address_line_2";

alter table "public"."clinics" drop column "city";

alter table "public"."clinics" drop column "code";

alter table "public"."clinics" drop column "state";

alter table "public"."clinics" drop column "zip";

alter table "public"."clinics" add column "address" text;

alter table "public"."clinics" add column "contact_name" text;

alter table "public"."clinics" add column "notes" text;

alter table "public"."products" alter column "base_price" set default 0;

CREATE UNIQUE INDEX case_sequences_pkey ON public.case_sequences USING btree (year);

CREATE UNIQUE INDEX clinic_users_user_id_key ON public.clinic_users USING btree (user_id);

CREATE UNIQUE INDEX clinic_products_pkey ON public.clinic_products USING btree (clinic_id, product_id);

alter table "public"."case_sequences" add constraint "case_sequences_pkey" PRIMARY KEY using index "case_sequences_pkey";

alter table "public"."clinic_products" add constraint "clinic_products_pkey" PRIMARY KEY using index "clinic_products_pkey";

alter table "public"."clinic_users" add constraint "clinic_users_user_id_key" UNIQUE using index "clinic_users_user_id_key";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.generate_case_number()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  current_year integer := extract(year from current_date);
  next_number integer;
  year_suffix text := lpad((current_year % 100)::text, 2, '0');
begin
  insert into public.case_sequences (year, last_number)
  values (current_year, 0)
  on conflict (year) do nothing;

  update public.case_sequences
  set last_number = last_number + 1
  where year = current_year
  returning last_number into next_number;

  return 'HPC' || year_suffix || '-' || lpad(next_number::text, 3, '0');
end;
$function$
;

CREATE OR REPLACE FUNCTION public.prevent_case_events_delete()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  raise exception 'case_events is append-only. DELETE is not allowed.';
end;
$function$
;

CREATE OR REPLACE FUNCTION public.prevent_case_events_update()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  raise exception 'case_events is append-only. UPDATE is not allowed.';
end;
$function$
;

grant delete on table "public"."case_sequences" to "anon";

grant insert on table "public"."case_sequences" to "anon";

grant references on table "public"."case_sequences" to "anon";

grant select on table "public"."case_sequences" to "anon";

grant trigger on table "public"."case_sequences" to "anon";

grant truncate on table "public"."case_sequences" to "anon";

grant update on table "public"."case_sequences" to "anon";

grant delete on table "public"."case_sequences" to "authenticated";

grant insert on table "public"."case_sequences" to "authenticated";

grant references on table "public"."case_sequences" to "authenticated";

grant select on table "public"."case_sequences" to "authenticated";

grant trigger on table "public"."case_sequences" to "authenticated";

grant truncate on table "public"."case_sequences" to "authenticated";

grant update on table "public"."case_sequences" to "authenticated";

grant delete on table "public"."case_sequences" to "service_role";

grant insert on table "public"."case_sequences" to "service_role";

grant references on table "public"."case_sequences" to "service_role";

grant select on table "public"."case_sequences" to "service_role";

grant trigger on table "public"."case_sequences" to "service_role";

grant truncate on table "public"."case_sequences" to "service_role";

grant update on table "public"."case_sequences" to "service_role";

CREATE TRIGGER case_events_no_delete BEFORE DELETE ON public.case_events FOR EACH ROW EXECUTE FUNCTION public.prevent_case_events_delete();

CREATE TRIGGER case_events_no_update BEFORE UPDATE ON public.case_events FOR EACH ROW EXECUTE FUNCTION public.prevent_case_events_update();


