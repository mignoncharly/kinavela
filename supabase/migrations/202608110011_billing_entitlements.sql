begin;

create or replace function kinavela_private.enforce_ai_entitlement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.feature in ('story_transcription', 'story_translation', 'story_adaptation')
     and not kinavela_private.family_has_entitlement(new.family_id, 'roots_stories_ai') then
    raise exception 'premium_entitlement_required';
  end if;
  return new;
end;
$$;

create trigger ai_jobs_premium_entitlement
  before insert on public.ai_jobs
  for each row execute function kinavela_private.enforce_ai_entitlement();

create or replace function kinavela_private.enforce_story_ai_entitlement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare story_family_id uuid;
begin
  select story.family_id into story_family_id from public.family_stories story where story.id = new.story_id;
  if story_family_id is null or not kinavela_private.family_has_entitlement(story_family_id, 'roots_stories_ai') then
    raise exception 'premium_entitlement_required';
  end if;
  return new;
end;
$$;

create trigger story_ai_jobs_premium_entitlement
  before insert on public.story_ai_jobs
  for each row execute function kinavela_private.enforce_story_ai_entitlement();

revoke all on function kinavela_private.enforce_ai_entitlement(), kinavela_private.enforce_story_ai_entitlement()
  from public, anon, authenticated, service_role;

insert into kinavela_private.schema_migrations(version)
values ('202608110011_billing_entitlements')
on conflict (version) do nothing;

notify pgrst, 'reload schema';
commit;
