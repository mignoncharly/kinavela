begin;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'playdates', 'playdate_time_options', 'playdate_reminder_deliveries',
    'event_messages'
  ] loop
    if not exists (
      select 1 from pg_class relation
      where relation.oid = format('public.%I', table_name)::regclass
        and relation.relrowsecurity and relation.relforcerowsecurity
    ) then raise exception 'Phase 8 table % must use forced RLS', table_name; end if;
  end loop;
  if has_table_privilege('authenticated', 'public.playdates', 'select')
    or has_table_privilege('authenticated', 'public.event_messages', 'select')
    or has_table_privilege('authenticated', 'kinavela_private.playdate_locations', 'select')
    or has_function_privilege('anon', 'public.list_my_playdates()', 'execute')
    or has_function_privilege('authenticated', 'public.dispatch_due_playdate_reminders()', 'execute')
  then raise exception 'Phase 8 private coordination grants are too broad'; end if;
end $$;

\set phase8_user_a '4aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
\set phase8_user_b '4bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
\set phase8_user_c '4ccccccc-cccc-4ccc-8ccc-cccccccccccc'
\set phase8_family_a '4aaaaaaa-2222-4222-8222-aaaaaaaaaaaa'
\set phase8_family_b '4bbbbbbb-2222-4222-8222-bbbbbbbbbbbb'
\set phase8_family_c '4ccccccc-2222-4222-8222-cccccccccccc'
\set phase8_connection '4aaaaaaa-3333-4333-8333-aaaaaaaaaaaa'
\set phase8_village '4aaaaaaa-4444-4444-8444-aaaaaaaaaaaa'

insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data,is_sso_user,is_anonymous,created_at,updated_at) values
  (:'phase8_user_a','phase8-a@example.test',now(),'{"display_name":"Parent A"}',false,false,now(),now()),
  (:'phase8_user_b','phase8-b@example.test',now(),'{"display_name":"Parent B"}',false,false,now(),now()),
  (:'phase8_user_c','phase8-c@example.test',now(),'{"display_name":"Parent C"}',false,false,now(),now());
select id as phase8_profile_a from public.profiles where auth_user_id=:'phase8_user_a'::uuid \gset
select id as phase8_profile_b from public.profiles where auth_user_id=:'phase8_user_b'::uuid \gset
select id as phase8_profile_c from public.profiles where auth_user_id=:'phase8_user_c'::uuid \gset
insert into public.families(id,name,slug,created_by,country_of_residence,city,location) values
  (:'phase8_family_a','Phase Eight A','phase-eight-a',:'phase8_profile_a','DE','Berlin',extensions.st_setsrid(extensions.st_makepoint(13.405,52.52),4326)::extensions.geography),
  (:'phase8_family_b','Phase Eight B','phase-eight-b',:'phase8_profile_b','DE','Berlin',extensions.st_setsrid(extensions.st_makepoint(13.41,52.52),4326)::extensions.geography),
  (:'phase8_family_c','Phase Eight C','phase-eight-c',:'phase8_profile_c','DE','Berlin',extensions.st_setsrid(extensions.st_makepoint(13.415,52.52),4326)::extensions.geography);
insert into public.family_members(family_id,profile_id,role,status) values
  (:'phase8_family_a',:'phase8_profile_a','owner','active'),
  (:'phase8_family_b',:'phase8_profile_b','owner','active'),
  (:'phase8_family_c',:'phase8_profile_c','owner','active');
insert into public.family_connections(id,requester_family_id,recipient_family_id,status,status_changed_by_family_id,responded_at,accepted_at)
values(:'phase8_connection',:'phase8_family_a',:'phase8_family_b','accepted',:'phase8_family_b',now(),now());
insert into public.villages(id,name,slug,description,city,center_location,created_by_family_id,created_by_profile_id)
values(:'phase8_village','Phase Eight Village','phase-eight-village','Private activity coordination test Village.','Berlin',extensions.st_setsrid(extensions.st_makepoint(13.405,52.52),4326)::extensions.geography,:'phase8_family_a',:'phase8_profile_a');
insert into public.village_members(village_id,family_id,role,status,initiated_by_family_id,joined_at) values
  (:'phase8_village',:'phase8_family_a','owner','active',:'phase8_family_a',now()),
  (:'phase8_village',:'phase8_family_b','member','active',:'phase8_family_a',now());

set local role authenticated;
select set_config('request.jwt.claim.sub',:'phase8_user_a',true);
select set_config('request.jwt.claims',json_build_object('sub',:'phase8_user_a','role','authenticated')::text,true);
select public.create_playdate(:'phase8_connection','Park afternoon','Near Tiergarten','Private Street 5, Berlin',array[now()+interval '3 days',now()+interval '4 days']::timestamptz[],1,2) as phase8_playdate \gset
select count(*)::integer as phase8_hidden_a from public.list_my_playdates()
where playdate_id=:'phase8_playdate'::uuid and exact_address is null \gset
select public.create_village_event(:'phase8_village','Weekly language circle','A recurring child-friendly language activity.','language',now()+interval '7 days',now()+interval '7 days 2 hours','Family room','Berlin','Private Hall 8, Berlin','Central Berlin','going',20,now()+interval '6 days','weekly',(now()+interval '29 days')::date) as phase8_event \gset
select count(*)::integer as phase8_occurrences from public.list_village_events(:'phase8_village')
where recurrence_series_id=(select recurrence_series_id from public.list_village_events(:'phase8_village') where event_id=:'phase8_event'::uuid) \gset
select public.send_event_message(:'phase8_event','Please bring one favourite children’s book.') as phase8_message \gset
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub',:'phase8_user_b',true);
select set_config('request.jwt.claims',json_build_object('sub',:'phase8_user_b','role','authenticated')::text,true);
select option_id as phase8_option from public.list_my_playdates(),
  lateral jsonb_to_recordset(time_options) as option_row(option_id uuid,starts_at timestamptz)
where playdate_id=:'phase8_playdate'::uuid order by starts_at limit 1 \gset
select public.respond_playdate(:'phase8_playdate',true,:'phase8_option',2,1);
select count(*)::integer as phase8_visible_b from public.list_my_playdates()
where playdate_id=:'phase8_playdate'::uuid and exact_address='Private Street 5, Berlin' \gset
select count(*)::integer as phase8_messages_b from public.list_event_messages(:'phase8_event',null,100)
where body='Please bring one favourite children’s book.' \gset
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub',:'phase8_user_c',true);
select set_config('request.jwt.claims',json_build_object('sub',:'phase8_user_c','role','authenticated')::text,true);
do $$ begin
  begin perform public.list_event_messages('00000000-0000-0000-0000-000000000000',null,100); exception when others then return; end;
  raise exception 'Non-members must not access event coordination';
end $$;
reset role;

select 1 / (
  (:'phase8_hidden_a'::integer = 1
    and :'phase8_visible_b'::integer = 1
    and :'phase8_messages_b'::integer = 1
    and :'phase8_occurrences'::integer between 4 and 5)::integer
);

rollback;
