\set ON_ERROR_STOP on
begin;

do $$
begin
  if not exists (
    select 1 from pg_class relation join pg_namespace namespace
      on namespace.oid=relation.relnamespace
    where namespace.nspname='public'
      and relation.relname='roots_entry_sharing_history'
      and relation.relrowsecurity and relation.relforcerowsecurity
  ) then raise exception 'Roots sharing history must use forced RLS'; end if;
  if has_table_privilege('authenticated','public.roots_entry_sharing_history','select')
    or has_function_privilege('anon','public.get_roots_media_path(uuid)','execute')
    or has_function_privilege('authenticated','public.claim_roots_passport_export()','execute')
    or not has_function_privilege('service_role','public.claim_roots_passport_export()','execute')
  then raise exception 'Phase 10 Roots grants are too broad'; end if;
  if exists(select 1 from storage.buckets where id in('roots-media','roots-exports') and public)
  then raise exception 'Roots storage buckets must remain private'; end if;
  if pg_get_function_result('public.list_roots_passport_entries_v2(uuid)'::regprocedure)
    ~* '(media_path|birth_year|birth_month|email|coordinate|longitude|latitude)'
  then raise exception 'Roots timeline projection exposes private fields'; end if;
end $$;

\set roots_user '5aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
\set roots_family '5aaaaaaa-1111-4111-8111-aaaaaaaaaaaa'
\set roots_child '5aaaaaaa-2222-4222-8222-aaaaaaaaaaaa'
\set roots_village '5aaaaaaa-3333-4333-8333-aaaaaaaaaaaa'

insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data,is_sso_user,is_anonymous,created_at,updated_at)
values(:'roots_user','phase10-roots@example.test',now(),'{"display_name":"Roots Guardian"}',false,false,now(),now());
select id as roots_profile from public.profiles where auth_user_id=:'roots_user'::uuid \gset
insert into public.families(id,name,slug,created_by,country_of_residence,city,location)
values(:'roots_family','Phase Ten Roots','phase-ten-roots',:'roots_profile','DE','Berlin',
  extensions.st_setsrid(extensions.st_makepoint(13.405,52.52),4326)::extensions.geography);
insert into public.family_members(family_id,profile_id,role,status)
values(:'roots_family',:'roots_profile','owner','active');
insert into public.children(id,family_id,nickname,birth_year,birth_month)
values(:'roots_child',:'roots_family','Little Root',2018,4);
select id as roots_passport from public.roots_passports where child_id=:'roots_child'::uuid \gset
insert into public.villages(id,name,slug,description,city,center_location,created_by_family_id,created_by_profile_id)
values(:'roots_village','Roots Village','roots-village-phase-ten','Private test Village.','Berlin',
  extensions.st_setsrid(extensions.st_makepoint(13.405,52.52),4326)::extensions.geography,
  :'roots_family',:'roots_profile');
insert into public.village_members(village_id,family_id,role,status,initiated_by_family_id,joined_at)
values(:'roots_village',:'roots_family','owner','active',:'roots_family',now());

set local role authenticated;
select set_config('request.jwt.claim.sub',:'roots_user',true);
select set_config('request.jwt.claims',json_build_object('sub',:'roots_user','role','authenticated')::text,true);
select public.create_roots_passport_entry(jsonb_build_object(
  'child_id',:'roots_child','type','family_memory','title','A protected memory',
  'description','A family-controlled Passport memory.','visibility','private'
)) as roots_entry \gset
select public.update_roots_passport_entry(:'roots_entry',jsonb_build_object(
  'type','family_memory','title','An edited protected memory',
  'description','A family-controlled Passport memory with explicit sharing.',
  'occurred_at',now(),'visibility','village','culture_id',null,'language_id',null,
  'event_id',null,'mission_id',null,'village_id',:'roots_village'
));
select count(*)::integer as roots_history from public.list_roots_entry_sharing_history(:'roots_entry')
  where previous_visibility='private' and new_visibility='village'
    and new_village_name='Roots Village' \gset
select count(*)::integer as roots_options from jsonb_array_elements(
  public.get_roots_passport_options(:'roots_child')->'villages') option
  where option->>'id'=:'roots_village' \gset
select public.request_roots_passport_export(:'roots_child') as roots_export \gset
reset role;

set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select export_id as claimed_export from public.claim_roots_passport_export()
  where export_id=:'roots_export'::uuid \gset
select public.get_roots_passport_export_payload(:'roots_export') as roots_payload \gset
select public.complete_roots_passport_export(
  :'roots_export',:'roots_passport'||'/'||:'roots_export'||'.json'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub',:'roots_user',true);
select set_config('request.jwt.claims',json_build_object('sub',:'roots_user','role','authenticated')::text,true);
select count(*)::integer as roots_ready from public.list_roots_passport_exports(:'roots_child')
  where export_id=:'roots_export'::uuid and status='ready' and attempts=1 \gset
reset role;
select count(*)::integer as roots_notification from public.notification_outbox
  where recipient_profile_id=:'roots_profile'::uuid
    and notification_kind='passport_export_ready'
    and payload ? 'export_id'
    and not (payload ?| array['child_id','child_name','media_path']) \gset

select 1 / ((:'roots_history'::integer=1
  and :'roots_options'::integer=1
  and :'roots_ready'::integer=1
  and :'roots_notification'::integer>=1
  and (:'roots_payload'::jsonb->>'format')='kinavela-roots-passport-v1'
  and not (:'roots_payload'::jsonb::text ~ 'roots-media/'))::integer);

rollback;
