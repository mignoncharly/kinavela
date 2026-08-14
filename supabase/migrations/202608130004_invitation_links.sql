begin;

create table public.invitation_links (
  id uuid primary key default gen_random_uuid(),
  token_digest text not null unique check (token_digest ~ '^[a-f0-9]{64}$'),
  invitation_kind text not null check (invitation_kind in ('family_referral', 'village')),
  created_by_profile_id uuid not null references public.profiles(id) on delete cascade,
  created_by_family_id uuid not null references public.families(id) on delete cascade,
  village_id uuid references public.villages(id) on delete cascade,
  event_id uuid references public.events(id) on delete cascade,
  locale text not null check (locale in ('de', 'fr', 'en')),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  max_claims integer not null check (max_claims between 1 and 100),
  claim_count integer not null default 0 check (claim_count between 0 and max_claims),
  created_at timestamptz not null default now(),
  check (expires_at > created_at),
  check (
    (invitation_kind = 'family_referral' and village_id is null and event_id is null)
    or (invitation_kind = 'village' and village_id is not null)
  )
);

create index invitation_links_creator_idx
  on public.invitation_links(created_by_profile_id, created_at desc);
create index invitation_links_active_idx
  on public.invitation_links(expires_at)
  where revoked_at is null;

create table public.invitation_claims (
  id uuid primary key default gen_random_uuid(),
  invitation_link_id uuid not null references public.invitation_links(id) on delete cascade,
  claimed_by_profile_id uuid not null references public.profiles(id) on delete cascade,
  claimed_by_family_id uuid not null references public.families(id) on delete cascade,
  outcome text not null check (outcome in ('referral_onboarded', 'village_joined')),
  claimed_at timestamptz not null default now(),
  unique(invitation_link_id, claimed_by_family_id)
);

create index invitation_claims_family_idx
  on public.invitation_claims(claimed_by_family_id, claimed_at desc);

alter table public.invitation_links enable row level security;
alter table public.invitation_links force row level security;
alter table public.invitation_claims enable row level security;
alter table public.invitation_claims force row level security;

revoke all on public.invitation_links, public.invitation_claims
from public, anon, authenticated;

create or replace function kinavela_private.invitation_digest(p_token text)
returns text
language sql
immutable
security definer
set search_path = ''
as $$
  select encode(
    extensions.digest(convert_to(coalesce(p_token, ''), 'utf8'), 'sha256'),
    'hex'
  )
$$;

revoke all on function kinavela_private.invitation_digest(text)
from public, anon, authenticated, service_role;

create or replace function public.create_invitation_link(
  p_invitation_kind text,
  p_village_id uuid default null,
  p_event_id uuid default null,
  p_locale text default 'de'
)
returns table(invitation_id uuid, raw_token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_uuid uuid := public.current_profile_id();
  family_uuid uuid := kinavela_private.current_family_id(false);
  token_value text;
  link_row public.invitation_links%rowtype;
begin
  if profile_uuid is null or family_uuid is null then raise exception 'not_authorized'; end if;
  if p_invitation_kind not in ('family_referral', 'village')
     or p_locale not in ('de', 'fr', 'en') then
    raise exception 'invalid_invitation';
  end if;

  if p_invitation_kind = 'family_referral' then
    if p_village_id is not null or p_event_id is not null then
      raise exception 'invalid_invitation';
    end if;
  else
    if p_village_id is null
       or not kinavela_private.can_access_village(p_village_id, true) then
      raise exception 'not_authorized';
    end if;
    if p_event_id is not null and not exists (
      select 1 from public.events event
      where event.id = p_event_id
        and event.village_id = p_village_id
        and event.status = 'scheduled'
    ) then raise exception 'event_not_available'; end if;
  end if;

  token_value := translate(
    encode(extensions.gen_random_bytes(32), 'base64'), E'+/=', '-_'
  );
  insert into public.invitation_links(
    token_digest, invitation_kind, created_by_profile_id,
    created_by_family_id, village_id, event_id, locale, expires_at, max_claims
  ) values (
    kinavela_private.invitation_digest(token_value), p_invitation_kind,
    profile_uuid, family_uuid, p_village_id, p_event_id, p_locale,
    now() + case when p_invitation_kind = 'family_referral'
      then interval '90 days' else interval '30 days' end,
    100
  ) returning * into link_row;

  insert into public.audit_events(
    actor_profile_id, event_type, entity_type, entity_id, metadata
  ) values (
    profile_uuid, 'invitation_link_created', 'invitation_link', link_row.id,
    jsonb_build_object(
      'kind', p_invitation_kind,
      'has_event', p_event_id is not null
    )
  );

  return query select link_row.id, token_value, link_row.expires_at;
end;
$$;

create or replace function public.revoke_invitation_link(p_invitation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare profile_uuid uuid := public.current_profile_id();
begin
  if profile_uuid is null then raise exception 'not_authenticated'; end if;
  update public.invitation_links
  set revoked_at = now()
  where id = p_invitation_id
    and created_by_profile_id = profile_uuid
    and revoked_at is null
    and expires_at > now();
  if not found then raise exception 'invitation_not_available'; end if;
  insert into public.audit_events(actor_profile_id, event_type, entity_type, entity_id)
  values (profile_uuid, 'invitation_link_revoked', 'invitation_link', p_invitation_id);
  return true;
end;
$$;

create or replace function public.list_my_invitation_links()
returns table(
  invitation_id uuid,
  invitation_kind text,
  village_name text,
  event_title text,
  locale text,
  expires_at timestamptz,
  revoked_at timestamptz,
  claim_count integer,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare profile_uuid uuid := public.current_profile_id();
begin
  if profile_uuid is null then raise exception 'not_authenticated'; end if;
  return query
  select link.id, link.invitation_kind, village.name, event.title,
    link.locale, link.expires_at, link.revoked_at, link.claim_count,
    link.created_at
  from public.invitation_links link
  left join public.villages village on village.id = link.village_id
  left join public.events event on event.id = link.event_id
  where link.created_by_profile_id = profile_uuid
  order by link.created_at desc
  limit 30;
end;
$$;

create or replace function public.get_public_invitation(p_token text)
returns table(
  invitation_kind text,
  invitation_locale text,
  village_name text,
  village_city text,
  country_focus_name text,
  event_title text,
  event_starts_at timestamptz,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select link.invitation_kind, link.locale,
    case when link.invitation_kind = 'village' then village.name else null end,
    case when link.invitation_kind = 'village' then village.city else null end,
    case when link.invitation_kind = 'village' then country.name else null end,
    case when link.invitation_kind = 'village' then event.title else null end,
    case when link.invitation_kind = 'village' then event.starts_at else null end,
    link.expires_at
  from public.invitation_links link
  left join public.villages village
    on village.id = link.village_id and village.status = 'active'
  left join public.countries country on country.id = village.country_focus_id
  left join public.events event
    on event.id = link.event_id and event.status = 'scheduled'
  where link.token_digest = kinavela_private.invitation_digest(p_token)
    and p_token ~ '^[A-Za-z0-9_-]{43}$'
    and link.revoked_at is null
    and link.expires_at > now()
    and link.claim_count < link.max_claims
    and (link.invitation_kind = 'family_referral' or village.id is not null)
    and (link.event_id is null or event.id is not null)
$$;

create or replace function public.record_referral_attribution(p_token text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_uuid uuid := public.current_profile_id();
  family_uuid uuid := kinavela_private.current_family_id(true);
  link_row public.invitation_links%rowtype;
begin
  if profile_uuid is null or family_uuid is null then raise exception 'not_authorized'; end if;
  select * into link_row from public.invitation_links link
  where link.token_digest = kinavela_private.invitation_digest(p_token)
    and p_token ~ '^[A-Za-z0-9_-]{43}$'
    and link.invitation_kind = 'family_referral'
    and link.revoked_at is null and link.expires_at > now()
    and link.claim_count < link.max_claims
  for update;
  if link_row.id is null then raise exception 'invitation_not_available'; end if;

  insert into public.invitation_claims(
    invitation_link_id, claimed_by_profile_id, claimed_by_family_id, outcome
  ) values (link_row.id, profile_uuid, family_uuid, 'referral_onboarded')
  on conflict(invitation_link_id, claimed_by_family_id) do nothing;
  if found then
    update public.invitation_links set claim_count = claim_count + 1
    where id = link_row.id;
  end if;
  return true;
end;
$$;

create or replace function public.accept_village_invitation_link(p_token text)
returns table(village_id uuid, event_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_uuid uuid := public.current_profile_id();
  family_uuid uuid := kinavela_private.current_family_id(true);
  link_row public.invitation_links%rowtype;
  village_row public.villages%rowtype;
begin
  if profile_uuid is null or family_uuid is null then raise exception 'owner_required'; end if;
  select * into link_row from public.invitation_links link
  where link.token_digest = kinavela_private.invitation_digest(p_token)
    and p_token ~ '^[A-Za-z0-9_-]{43}$'
    and link.invitation_kind = 'village'
    and link.revoked_at is null and link.expires_at > now()
    and link.claim_count < link.max_claims
  for update;
  if link_row.id is null then raise exception 'invitation_not_available'; end if;

  select * into village_row from public.villages village
  where village.id = link_row.village_id and village.status = 'active'
  for update;
  if village_row.id is null then raise exception 'village_not_available'; end if;
  if link_row.event_id is not null and not exists (
    select 1 from public.events event where event.id = link_row.event_id
      and event.village_id = village_row.id and event.status = 'scheduled'
  ) then raise exception 'event_not_available'; end if;

  if not exists (
    select 1 from public.families family
    where family.id = family_uuid and family.location is not null
      and extensions.st_dwithin(
        family.location, village_row.center_location,
        least(family.discovery_radius_km, village_row.radius_km) * 1000.0
      )
  ) then raise exception 'geographic_eligibility_required'; end if;
  if exists (
    select 1 from public.village_members member
    join public.discovery_blocks block on (
      (block.blocker_family_id = family_uuid and block.blocked_family_id = member.family_id)
      or (block.blocked_family_id = family_uuid and block.blocker_family_id = member.family_id)
    ) where member.village_id = village_row.id and member.status = 'active'
  ) then raise exception 'village_not_available'; end if;
  if exists (
    select 1 from public.village_members member
    where member.village_id = village_row.id and member.family_id = family_uuid
      and member.status = 'active'
  ) then raise exception 'membership_already_exists'; end if;

  insert into public.village_members(
    village_id, family_id, role, status, initiated_by_family_id
  ) values (
    village_row.id, family_uuid, 'member', 'invited', link_row.created_by_family_id
  ) on conflict on constraint village_members_village_id_family_id_key do update
    set role = 'member', status = 'invited',
        initiated_by_family_id = link_row.created_by_family_id,
        joined_at = null, responded_at = null, updated_at = now()
    where public.village_members.status in ('requested', 'invited', 'declined', 'removed');
  if not found then raise exception 'membership_already_exists'; end if;

  perform kinavela_private.activate_village_family(village_row.id, family_uuid);
  insert into public.invitation_claims(
    invitation_link_id, claimed_by_profile_id, claimed_by_family_id, outcome
  ) values (link_row.id, profile_uuid, family_uuid, 'village_joined');
  update public.invitation_links set claim_count = claim_count + 1
  where id = link_row.id;
  insert into public.village_moderation_actions(
    village_id, actor_profile_id, actor_family_id, action_type,
    target_family_id, metadata
  ) values (
    village_row.id, profile_uuid, family_uuid, 'invite_accepted',
    family_uuid, jsonb_build_object('invitation_link_id', link_row.id)
  );
  insert into public.audit_events(
    actor_profile_id, event_type, entity_type, entity_id,
    metadata
  ) values (
    profile_uuid, 'invitation_link_claimed', 'invitation_link', link_row.id,
    jsonb_build_object('kind', 'village', 'has_event', link_row.event_id is not null)
  );
  return query select village_row.id, link_row.event_id;
end;
$$;

revoke all on function public.create_invitation_link(text, uuid, uuid, text),
  public.revoke_invitation_link(uuid), public.list_my_invitation_links(),
  public.get_public_invitation(text), public.record_referral_attribution(text),
  public.accept_village_invitation_link(text)
from public, anon, authenticated, service_role;
grant execute on function public.get_public_invitation(text) to anon, authenticated;
grant execute on function public.create_invitation_link(text, uuid, uuid, text),
  public.revoke_invitation_link(uuid), public.list_my_invitation_links(),
  public.record_referral_attribution(text),
  public.accept_village_invitation_link(text)
to authenticated;

insert into kinavela_private.schema_migrations(version)
values ('202608130004_invitation_links')
on conflict (version) do nothing;

notify pgrst, 'reload schema';
commit;
