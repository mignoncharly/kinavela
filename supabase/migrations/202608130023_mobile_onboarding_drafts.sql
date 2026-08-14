begin;
create table kinavela_private.onboarding_drafts (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  draft jsonb not null,
  updated_at timestamptz not null default now(),
  constraint onboarding_drafts_object check (jsonb_typeof(draft) = 'object'),
  constraint onboarding_drafts_size check (octet_length(draft::text) <= 32768)
);

revoke all on table kinavela_private.onboarding_drafts from public, anon, authenticated;

create or replace function public.get_my_onboarding_draft()
returns jsonb language sql stable security definer set search_path = '' as $$
  select draft.draft from kinavela_private.onboarding_drafts draft
  where draft.profile_id = public.current_profile_id()
    and draft.updated_at >= now() - interval '30 days'
$$;

create or replace function public.save_my_onboarding_draft(p_draft jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare profile_uuid uuid := public.current_profile_id();
begin
  if jsonb_typeof(p_draft) <> 'object' or octet_length(p_draft::text) > 32768
    or exists (select 1 from jsonb_object_keys(p_draft) key
      where key not in ('version', 'step', 'children', 'languageRows', 'availabilityRows', 'values'))
    or jsonb_typeof(p_draft->'values') <> 'object'
    or exists (select 1 from jsonb_object_keys(p_draft->'values') key
      where key ~* '(password|token|secret|email)') then
    raise exception 'invalid_onboarding_draft';
  end if;
  delete from kinavela_private.onboarding_drafts
  where updated_at < now() - interval '30 days';

  insert into kinavela_private.onboarding_drafts(profile_id, draft, updated_at)
  values (profile_uuid, p_draft, now())
  on conflict (profile_id) do update set draft = excluded.draft, updated_at = excluded.updated_at;
end;
$$;

create or replace function public.delete_my_onboarding_draft()
returns void language sql security definer set search_path = '' as $$
  delete from kinavela_private.onboarding_drafts where profile_id = public.current_profile_id()
$$;

revoke all on function public.get_my_onboarding_draft(), public.save_my_onboarding_draft(jsonb),
  public.delete_my_onboarding_draft() from public, anon;
grant execute on function public.get_my_onboarding_draft(), public.save_my_onboarding_draft(jsonb),
  public.delete_my_onboarding_draft() to authenticated;

insert into kinavela_private.schema_migrations(version) values('202608130023_mobile_onboarding_drafts') on conflict(version) do nothing;

notify pgrst,'reload schema';
commit;
