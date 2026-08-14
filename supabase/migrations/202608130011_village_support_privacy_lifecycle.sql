begin;

create or replace function public.get_personal_data_export_payload(p_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare payload jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role_required';
  end if;
  select jsonb_build_object(
    'exported_at', now(),
    'profile', (
      select to_jsonb(profile) - 'auth_user_id' - 'avatar_path'
      from public.profiles profile where profile.id = p_profile_id
    ),
    'families', coalesce((
      select jsonb_agg(to_jsonb(family) - 'location' order by family.created_at)
      from public.families family
      join public.family_members member on member.family_id = family.id
      where member.profile_id = p_profile_id
    ), '[]'::jsonb),
    'children', coalesce((
      select jsonb_agg(to_jsonb(child) - 'avatar_path' order by child.created_at)
      from public.children child
      join public.family_members member on member.family_id = child.family_id
      where member.profile_id = p_profile_id and member.status = 'active'
    ), '[]'::jsonb),
    'consents', coalesce((
      select jsonb_agg(to_jsonb(consent) order by consent.created_at)
      from public.consents consent where consent.profile_id = p_profile_id
    ), '[]'::jsonb),
    'notifications', coalesce((
      select to_jsonb(preferences) - 'profile_id'
      from public.notification_preferences preferences
      where preferences.profile_id = p_profile_id
    ), '{}'::jsonb),
    'stories', coalesce((
      select jsonb_agg(
        to_jsonb(story) - 'original_audio_path' order by story.created_at
      )
      from public.family_stories story
      join public.family_members member on member.family_id = story.family_id
      where member.profile_id = p_profile_id and member.status = 'active'
    ), '[]'::jsonb),
    'passport_entries', coalesce((
      select jsonb_agg(
        to_jsonb(entry) - 'media_path' order by entry.created_at
      )
      from public.roots_passport_entries entry
      join public.roots_passports passport on passport.id = entry.passport_id
      join public.children child on child.id = passport.child_id
      join public.family_members member on member.family_id = child.family_id
      where member.profile_id = p_profile_id and member.status = 'active'
    ), '[]'::jsonb),
    'messages', coalesce((
      select jsonb_agg(to_jsonb(message) order by message.created_at)
      from public.messages message where message.sender_profile_id = p_profile_id
    ), '[]'::jsonb),
    'village_support_posts', coalesce((
      select jsonb_agg(
        to_jsonb(post) - 'search_document' order by post.created_at
      )
      from public.village_support_posts post
      where post.author_profile_id = p_profile_id
    ), '[]'::jsonb),
    'village_support_replies', coalesce((
      select jsonb_agg(
        to_jsonb(reply) - 'search_document' order by reply.created_at
      )
      from public.village_support_replies reply
      where reply.author_profile_id = p_profile_id
    ), '[]'::jsonb),
    'reports', coalesce((
      select jsonb_agg(to_jsonb(report) order by report.created_at)
      from public.reports report where report.reporter_profile_id = p_profile_id
    ), '[]'::jsonb)
  ) into payload;
  return payload;
end;
$$;

create or replace function kinavela_private.erase_profile_support_content()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status is distinct from new.status and new.status = 'deleted' then
    update public.village_support_replies set
      body = '[removed after account deletion]',
      removed_at = coalesce(removed_at, now()),
      removed_by_profile_id = null,
      updated_at = now()
    where author_profile_id = new.id;
    update public.village_support_posts set
      title = 'Removed support post',
      body = 'This support post was removed after account deletion.',
      status = 'removed',
      resolved_at = null,
      removed_at = coalesce(removed_at, now()),
      removed_by_profile_id = null,
      updated_at = now()
    where author_profile_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_erase_support_content on public.profiles;
create trigger profiles_erase_support_content
  before update of status on public.profiles
  for each row execute function kinavela_private.erase_profile_support_content();

revoke all on function public.get_personal_data_export_payload(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_personal_data_export_payload(uuid)
  to service_role;
revoke all on function kinavela_private.erase_profile_support_content()
  from public, anon, authenticated, service_role;

insert into kinavela_private.schema_migrations(version)
values ('202608130011_village_support_privacy_lifecycle');

notify pgrst, 'reload schema';
commit;
