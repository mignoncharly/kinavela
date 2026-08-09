begin;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text not null default 'Kinavela family' check (char_length(display_name) between 2 and 80),
  avatar_path text,
  preferred_language text not null default 'de' check (preferred_language in ('de', 'fr', 'en')),
  timezone text not null default 'Europe/Berlin' check (char_length(timezone) between 3 and 64),
  country_of_residence text check (country_of_residence ~ '^[A-Z]{2}$'),
  city text check (city is null or char_length(city) between 2 and 120),
  onboarding_completed boolean not null default false,
  verification_level text not null default 'email_unverified' check (verification_level in ('email_unverified', 'email_verified', 'phone_verified', 'community_verified', 'identity_verified')),
  status text not null default 'active' check (status in ('active', 'suspended', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.consents (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  consent_type text not null check (consent_type in ('privacy_policy', 'terms', 'community_guidelines', 'product_email')),
  policy_version text not null check (char_length(policy_version) between 1 and 32),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (revoked_at is null or revoked_at >= granted_at)
);

create unique index consents_active_unique
  on public.consents(profile_id, consent_type)
  where revoked_at is null;
create index consents_profile_id_idx on public.consents(profile_id);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid references public.profiles(id) on delete set null,
  event_type text not null check (char_length(event_type) between 3 and 80),
  entity_type text check (entity_type is null or char_length(entity_type) between 2 and 40),
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index audit_events_actor_created_idx on public.audit_events(actor_profile_id, created_at desc);
create index audit_events_event_created_idx on public.audit_events(event_type, created_at desc);

create table public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'cancelled', 'processing', 'completed')),
  requested_at timestamptz not null default now(),
  cancelled_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index account_deletion_active_unique
  on public.account_deletion_requests(profile_id)
  where status in ('pending', 'processing');
create index account_deletion_profile_idx on public.account_deletion_requests(profile_id);

create table public.countries (
  id uuid primary key default gen_random_uuid(),
  iso2 text not null unique check (iso2 ~ '^[A-Z]{2}$'),
  iso3 text not null unique check (iso3 ~ '^[A-Z]{3}$'),
  name text not null unique check (char_length(name) between 2 and 120),
  emoji text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now()
);

create table public.cultures (
  id uuid primary key default gen_random_uuid(),
  country_id uuid references public.countries(id) on delete restrict,
  name text not null check (char_length(name) between 2 and 120),
  type text not null check (type in ('country', 'regional', 'cultural', 'community')),
  parent_culture_id uuid references public.cultures(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  unique(country_id, name)
);

create index cultures_country_idx on public.cultures(country_id);
create index cultures_parent_idx on public.cultures(parent_culture_id);

create table public.languages (
  id uuid primary key default gen_random_uuid(),
  iso_code text not null unique check (iso_code ~ '^[a-z0-9-]{2,16}$'),
  name text not null unique check (char_length(name) between 2 and 120),
  native_name text not null check (char_length(native_name) between 2 and 120),
  created_at timestamptz not null default now()
);

create table public.interests (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,64}$'),
  name_key text not null unique check (name_key ~ '^interests\.[a-z0-9_]+$'),
  sort_order smallint not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 100),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,140}$'),
  created_by uuid not null references public.profiles(id) on delete restrict,
  country_of_residence text not null check (country_of_residence ~ '^[A-Z]{2}$'),
  city text not null check (char_length(city) between 2 and 120),
  location extensions.geography(Point, 4326),
  location_precision text not null default 'city' check (location_precision in ('city', 'postcode', 'approximate_device')),
  discovery_radius_km integer not null default 40 check (discovery_radius_km between 5 and 100),
  visibility text not null default 'discoverable' check (visibility in ('private', 'discoverable')),
  bio text check (bio is null or char_length(bio) <= 600),
  preservation_goals text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (preservation_goals <@ array['language', 'stories', 'recipes', 'traditions', 'history', 'music', 'family_connections']::text[])
);

create index families_created_by_idx on public.families(created_by);
create index families_location_idx on public.families using gist(location);
create index families_country_city_idx on public.families(country_of_residence, city);

create table public.family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner', 'guardian', 'member')),
  status text not null default 'active' check (status in ('invited', 'active', 'removed')),
  created_at timestamptz not null default now(),
  unique(family_id, profile_id)
);

create index family_members_profile_idx on public.family_members(profile_id, status);
create index family_members_family_idx on public.family_members(family_id, status);
create unique index family_single_owner_idx on public.family_members(family_id) where role = 'owner' and status = 'active';

create table public.children (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 40),
  birth_year smallint not null check (birth_year between 2005 and extract(year from current_date)::integer),
  birth_month smallint check (birth_month between 1 and 12),
  gender text check (gender is null or gender in ('female', 'male', 'nonbinary', 'prefer_not_to_say')),
  avatar_path text,
  visibility text not null default 'guardians' check (visibility in ('guardians', 'connections')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index children_family_idx on public.children(family_id);

create table public.family_cultures (
  family_id uuid not null references public.families(id) on delete cascade,
  culture_id uuid not null references public.cultures(id) on delete restrict,
  relationship_type text not null check (relationship_type in ('origin', 'heritage', 'connection', 'interest')),
  priority smallint not null default 1 check (priority between 1 and 5),
  created_at timestamptz not null default now(),
  primary key(family_id, culture_id)
);

create index family_cultures_culture_idx on public.family_cultures(culture_id);

create table public.family_languages (
  family_id uuid not null references public.families(id) on delete cascade,
  language_id uuid not null references public.languages(id) on delete restrict,
  proficiency text not null check (proficiency in ('beginner', 'conversational', 'fluent', 'native')),
  transmission_goal text not null check (transmission_goal in ('already_speaking', 'learning', 'want_to_teach_children', 'cultural_interest')),
  created_at timestamptz not null default now(),
  primary key(family_id, language_id)
);

create index family_languages_language_idx on public.family_languages(language_id);

create table public.family_interests (
  family_id uuid not null references public.families(id) on delete cascade,
  interest_id uuid not null references public.interests(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key(family_id, interest_id)
);

create index family_interests_interest_idx on public.family_interests(interest_id);

create table public.family_availability (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  period text not null check (period in ('morning', 'afternoon', 'evening')),
  created_at timestamptz not null default now(),
  unique(family_id, weekday, period)
);

create index family_availability_family_idx on public.family_availability(family_id);

create table public.discovery_preferences (
  family_id uuid primary key references public.families(id) on delete cascade,
  radius_km integer not null default 40 check (radius_km between 5 and 100),
  same_country_priority smallint not null default 4 check (same_country_priority between 0 and 5),
  same_culture_priority smallint not null default 4 check (same_culture_priority between 0 and 5),
  similar_child_age_priority smallint not null default 4 check (similar_child_age_priority between 0 and 5),
  same_language_priority smallint not null default 3 check (same_language_priority between 0 and 5),
  shared_interests_priority smallint not null default 3 check (shared_interests_priority between 0 and 5),
  availability_priority smallint not null default 2 check (availability_priority between 0 and 5),
  open_to_other_african_families boolean not null default true,
  open_to_all_diaspora_families boolean not null default false,
  min_child_age smallint not null default 0 check (min_child_age between 0 and 20),
  max_child_age smallint not null default 18 check (max_child_age between 0 and 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (min_child_age <= max_child_age)
);

create table kinavela_private.auth_rate_limits (
  identifier_hash text not null check (char_length(identifier_hash) = 64),
  action text not null check (action in ('signup', 'magic_link', 'recovery', 'login')),
  window_started_at timestamptz not null default now(),
  attempts integer not null default 1 check (attempts > 0),
  primary key(identifier_hash, action)
);

create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.profiles where auth_user_id = auth.uid() and status = 'active' limit 1;
$$;

create or replace function public.is_family_member(p_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.family_members
    where family_id = p_family_id
      and profile_id = public.current_profile_id()
      and status = 'active'
  );
$$;

create or replace function public.is_family_owner(p_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.family_members
    where family_id = p_family_id
      and profile_id = public.current_profile_id()
      and role = 'owner'
      and status = 'active'
  );
$$;

create or replace function kinavela_private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_profile_id uuid;
  initial_name text;
begin
  initial_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), '');
  if initial_name is null or char_length(initial_name) < 2 then
    initial_name := 'Kinavela family';
  end if;

  insert into public.profiles(auth_user_id, display_name, preferred_language, verification_level)
  values (
    new.id,
    left(initial_name, 80),
    case when new.raw_user_meta_data ->> 'preferred_language' in ('de', 'fr', 'en') then new.raw_user_meta_data ->> 'preferred_language' else 'de' end,
    case when new.email_confirmed_at is null then 'email_unverified' else 'email_verified' end
  )
  returning id into new_profile_id;

  insert into public.audit_events(actor_profile_id, event_type, entity_type, entity_id)
  values (new_profile_id, 'profile_created', 'profile', new_profile_id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function kinavela_private.handle_new_auth_user();

create or replace function kinavela_private.sync_email_verification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    update public.profiles
      set verification_level = 'email_verified', updated_at = now()
      where auth_user_id = new.id and verification_level = 'email_unverified';
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_confirmed on auth.users;
create trigger on_auth_user_email_confirmed
  after update of email_confirmed_at on auth.users
  for each row execute function kinavela_private.sync_email_verification();

create or replace function public.consume_auth_rate_limit(
  p_identifier_hash text,
  p_action text,
  p_max_attempts integer default 5,
  p_window_seconds integer default 900
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  resulting_attempts integer;
begin
  if char_length(p_identifier_hash) <> 64
     or p_action not in ('signup', 'magic_link', 'recovery', 'login')
     or p_max_attempts not between 1 and 30
     or p_window_seconds not between 60 and 86400 then
    return false;
  end if;

  insert into kinavela_private.auth_rate_limits(identifier_hash, action)
  values (p_identifier_hash, p_action)
  on conflict(identifier_hash, action) do update
    set attempts = case
      when kinavela_private.auth_rate_limits.window_started_at < now() - make_interval(secs => p_window_seconds) then 1
      else kinavela_private.auth_rate_limits.attempts + 1
    end,
    window_started_at = case
      when kinavela_private.auth_rate_limits.window_started_at < now() - make_interval(secs => p_window_seconds) then now()
      else kinavela_private.auth_rate_limits.window_started_at
    end
  returning attempts into resulting_attempts;

  return resulting_attempts <= p_max_attempts;
end;
$$;

create or replace function public.auth_email_registered(p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from auth.users
    where lower(email) = lower(trim(p_email))
      and deleted_at is null
  );
$$;

create or replace function public.request_account_deletion()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_uuid uuid := public.current_profile_id();
  request_uuid uuid;
begin
  if profile_uuid is null then raise exception 'not_authenticated'; end if;

  insert into public.account_deletion_requests(profile_id)
  values (profile_uuid)
  on conflict (profile_id) where status in ('pending', 'processing')
  do update set requested_at = now(), updated_at = now()
  returning id into request_uuid;

  insert into public.audit_events(actor_profile_id, event_type, entity_type, entity_id)
  values (profile_uuid, 'account_deletion_requested', 'account_deletion_request', request_uuid);
  return request_uuid;
end;
$$;

create or replace function public.complete_family_onboarding(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_uuid uuid := public.current_profile_id();
  family_uuid uuid := gen_random_uuid();
  family_name text := trim(p_payload #>> '{family,name}');
  display_name_value text := trim(p_payload ->> 'display_name');
  city_value text := trim(p_payload #>> '{family,city}');
  country_value text := upper(trim(p_payload #>> '{family,country_of_residence}'));
  language_value text := coalesce(p_payload ->> 'preferred_language', 'de');
  child_value jsonb;
  language_item jsonb;
  availability_item jsonb;
  reference_id uuid;
begin
  if profile_uuid is null then raise exception 'not_authenticated'; end if;
  if exists (select 1 from public.family_members where profile_id = profile_uuid and status = 'active') then
    raise exception 'family_already_exists';
  end if;
  if char_length(display_name_value) not between 2 and 80 then raise exception 'invalid_display_name'; end if;
  if char_length(family_name) not between 2 and 100 then raise exception 'invalid_family_name'; end if;
  if char_length(city_value) not between 2 and 120 then raise exception 'invalid_city'; end if;
  if country_value !~ '^[A-Z]{2}$' then raise exception 'invalid_country'; end if;
  if language_value not in ('de', 'fr', 'en') then raise exception 'invalid_language'; end if;
  if jsonb_typeof(p_payload -> 'children') <> 'array' or jsonb_array_length(p_payload -> 'children') not between 1 and 8 then
    raise exception 'invalid_children';
  end if;
  if jsonb_typeof(p_payload -> 'culture_ids') <> 'array'
     or jsonb_typeof(p_payload -> 'languages') <> 'array'
     or jsonb_typeof(p_payload -> 'interest_ids') <> 'array'
     or jsonb_typeof(p_payload -> 'availability') <> 'array' then
    raise exception 'invalid_collections';
  end if;

  update public.profiles set
    display_name = display_name_value,
    preferred_language = language_value,
    timezone = coalesce(nullif(trim(p_payload ->> 'timezone'), ''), 'Europe/Berlin'),
    country_of_residence = country_value,
    city = city_value,
    onboarding_completed = true,
    updated_at = now()
  where id = profile_uuid;

  insert into public.families(
    id, name, slug, created_by, country_of_residence, city,
    discovery_radius_km, visibility, bio, preservation_goals
  ) values (
    family_uuid,
    family_name,
    trim(both '-' from regexp_replace(lower(family_name), '[^a-z0-9]+', '-', 'g')) || '-' || left(family_uuid::text, 8),
    profile_uuid,
    country_value,
    city_value,
    greatest(5, least(100, coalesce((p_payload #>> '{family,radius_km}')::integer, 40))),
    case when p_payload #>> '{family,visibility}' in ('private', 'discoverable') then p_payload #>> '{family,visibility}' else 'discoverable' end,
    nullif(trim(p_payload #>> '{family,bio}'), ''),
    coalesce(array(select jsonb_array_elements_text(p_payload -> 'preservation_goals')), '{}'::text[])
  );

  insert into public.family_members(family_id, profile_id, role, status)
  values (family_uuid, profile_uuid, 'owner', 'active');

  for child_value in select value from jsonb_array_elements(p_payload -> 'children') loop
    insert into public.children(family_id, nickname, birth_year, birth_month, gender, visibility)
    values (
      family_uuid,
      left(trim(child_value ->> 'nickname'), 40),
      (child_value ->> 'birth_year')::smallint,
      nullif(child_value ->> 'birth_month', '')::smallint,
      nullif(child_value ->> 'gender', ''),
      'guardians'
    );
  end loop;

  for reference_id in select value::text::uuid from jsonb_array_elements_text(p_payload -> 'culture_ids') loop
    insert into public.family_cultures(family_id, culture_id, relationship_type)
    values (family_uuid, reference_id, 'origin');
  end loop;

  for language_item in select value from jsonb_array_elements(p_payload -> 'languages') loop
    insert into public.family_languages(family_id, language_id, proficiency, transmission_goal)
    values (
      family_uuid,
      (language_item ->> 'language_id')::uuid,
      language_item ->> 'proficiency',
      language_item ->> 'transmission_goal'
    );
  end loop;

  for reference_id in select value::text::uuid from jsonb_array_elements_text(p_payload -> 'interest_ids') loop
    insert into public.family_interests(family_id, interest_id) values (family_uuid, reference_id);
  end loop;

  for availability_item in select value from jsonb_array_elements(p_payload -> 'availability') loop
    insert into public.family_availability(family_id, weekday, period)
    values (family_uuid, (availability_item ->> 'weekday')::smallint, availability_item ->> 'period');
  end loop;

  insert into public.discovery_preferences(
    family_id, radius_km, open_to_other_african_families,
    open_to_all_diaspora_families, min_child_age, max_child_age
  ) values (
    family_uuid,
    greatest(5, least(100, coalesce((p_payload #>> '{family,radius_km}')::integer, 40))),
    coalesce((p_payload #>> '{preferences,open_to_other_african_families}')::boolean, true),
    coalesce((p_payload #>> '{preferences,open_to_all_diaspora_families}')::boolean, false),
    greatest(0, least(20, coalesce((p_payload #>> '{preferences,min_child_age}')::smallint, 0))),
    greatest(0, least(20, coalesce((p_payload #>> '{preferences,max_child_age}')::smallint, 18)))
  );

  insert into public.consents(profile_id, consent_type, policy_version)
  values
    (profile_uuid, 'privacy_policy', '2026-08-09'),
    (profile_uuid, 'terms', '2026-08-09'),
    (profile_uuid, 'community_guidelines', '2026-08-09')
  on conflict (profile_id, consent_type) where revoked_at is null do nothing;

  insert into public.audit_events(actor_profile_id, event_type, entity_type, entity_id)
  values (profile_uuid, 'family_created', 'family', family_uuid),
         (profile_uuid, 'onboarding_completed', 'family', family_uuid);
  return family_uuid;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'profiles', 'consents', 'audit_events', 'account_deletion_requests',
    'countries', 'cultures', 'languages', 'interests', 'families',
    'family_members', 'children', 'family_cultures', 'family_languages',
    'family_interests', 'family_availability', 'discovery_preferences'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
  end loop;
end $$;

create policy "Profiles read own" on public.profiles for select to authenticated using (auth_user_id = auth.uid());
create policy "Profiles update own" on public.profiles for update to authenticated using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());
create policy "Consents read own" on public.consents for select to authenticated using (profile_id = public.current_profile_id());
create policy "Consents create own" on public.consents for insert to authenticated with check (profile_id = public.current_profile_id());
create policy "Consents update own" on public.consents for update to authenticated using (profile_id = public.current_profile_id()) with check (profile_id = public.current_profile_id());
create policy "Audit events read own" on public.audit_events for select to authenticated using (actor_profile_id = public.current_profile_id());
create policy "Deletion requests read own" on public.account_deletion_requests for select to authenticated using (profile_id = public.current_profile_id());

create policy "Countries are readable" on public.countries for select to anon, authenticated using (true);
create policy "Cultures are readable" on public.cultures for select to anon, authenticated using (true);
create policy "Languages are readable" on public.languages for select to anon, authenticated using (true);
create policy "Interests are readable" on public.interests for select to anon, authenticated using (active);

create policy "Members read family" on public.families for select to authenticated using (public.is_family_member(id));
create policy "Owners update family" on public.families for update to authenticated using (public.is_family_owner(id)) with check (public.is_family_owner(id));
create policy "Members read memberships" on public.family_members for select to authenticated using (public.is_family_member(family_id));
create policy "Owners manage memberships" on public.family_members for all to authenticated using (public.is_family_owner(family_id)) with check (public.is_family_owner(family_id));
create policy "Members read children" on public.children for select to authenticated using (public.is_family_member(family_id));
create policy "Owners manage children" on public.children for all to authenticated using (public.is_family_owner(family_id)) with check (public.is_family_owner(family_id));
create policy "Members read cultures" on public.family_cultures for select to authenticated using (public.is_family_member(family_id));
create policy "Owners manage cultures" on public.family_cultures for all to authenticated using (public.is_family_owner(family_id)) with check (public.is_family_owner(family_id));
create policy "Members read languages" on public.family_languages for select to authenticated using (public.is_family_member(family_id));
create policy "Owners manage languages" on public.family_languages for all to authenticated using (public.is_family_owner(family_id)) with check (public.is_family_owner(family_id));
create policy "Members read interests" on public.family_interests for select to authenticated using (public.is_family_member(family_id));
create policy "Owners manage interests" on public.family_interests for all to authenticated using (public.is_family_owner(family_id)) with check (public.is_family_owner(family_id));
create policy "Members read availability" on public.family_availability for select to authenticated using (public.is_family_member(family_id));
create policy "Owners manage availability" on public.family_availability for all to authenticated using (public.is_family_owner(family_id)) with check (public.is_family_owner(family_id));
create policy "Members read discovery preferences" on public.discovery_preferences for select to authenticated using (public.is_family_member(family_id));
create policy "Owners manage discovery preferences" on public.discovery_preferences for all to authenticated using (public.is_family_owner(family_id)) with check (public.is_family_owner(family_id));

revoke all on all tables in schema public from anon, authenticated;
grant select on public.system_status, public.countries, public.cultures, public.languages, public.interests to anon, authenticated;
grant select on public.profiles to authenticated;
grant update(display_name, avatar_path, preferred_language, timezone, country_of_residence, city) on public.profiles to authenticated;
grant select, insert, update on public.consents to authenticated;
grant select on public.audit_events, public.account_deletion_requests to authenticated;
grant select, update on public.families to authenticated;
grant select, insert, update, delete on public.family_members, public.children, public.family_cultures,
  public.family_languages, public.family_interests, public.family_availability, public.discovery_preferences to authenticated;

revoke all on function public.current_profile_id() from public;
revoke all on function public.is_family_member(uuid) from public;
revoke all on function public.is_family_owner(uuid) from public;
revoke all on function public.complete_family_onboarding(jsonb) from public;
revoke all on function public.request_account_deletion() from public;
revoke all on function public.consume_auth_rate_limit(text, text, integer, integer) from public;
revoke all on function public.auth_email_registered(text) from public;
grant execute on function public.current_profile_id(), public.is_family_member(uuid), public.is_family_owner(uuid),
  public.complete_family_onboarding(jsonb), public.request_account_deletion() to authenticated;
grant execute on function public.consume_auth_rate_limit(text, text, integer, integer) to service_role;
grant execute on function public.auth_email_registered(text) to service_role;

create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger families_set_updated_at before update on public.families for each row execute function public.set_updated_at();
create trigger children_set_updated_at before update on public.children for each row execute function public.set_updated_at();
create trigger discovery_preferences_set_updated_at before update on public.discovery_preferences for each row execute function public.set_updated_at();
create trigger account_deletion_set_updated_at before update on public.account_deletion_requests for each row execute function public.set_updated_at();

insert into public.countries(id, iso2, iso3, name, emoji) values
  ('10000000-0000-4000-8000-000000000001', 'CM', 'CMR', 'Cameroon', '🇨🇲'),
  ('10000000-0000-4000-8000-000000000002', 'DE', 'DEU', 'Germany', '🇩🇪')
on conflict (iso2) do nothing;

insert into public.cultures(id, country_id, name, type) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Cameroon', 'country'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'Bamiléké', 'cultural'),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'Bassa', 'cultural'),
  ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', 'Beti', 'cultural'),
  ('20000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001', 'Duala', 'cultural'),
  ('20000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000002', 'Germany', 'country')
on conflict (country_id, name) do nothing;

insert into public.languages(id, iso_code, name, native_name) values
  ('30000000-0000-4000-8000-000000000001', 'de', 'German', 'Deutsch'),
  ('30000000-0000-4000-8000-000000000002', 'fr', 'French', 'Français'),
  ('30000000-0000-4000-8000-000000000003', 'en', 'English', 'English'),
  ('30000000-0000-4000-8000-000000000004', 'dua', 'Duala', 'Duala'),
  ('30000000-0000-4000-8000-000000000005', 'bas', 'Basaa', 'Ɓasaá'),
  ('30000000-0000-4000-8000-000000000006', 'ewo', 'Ewondo', 'Ewondo'),
  ('30000000-0000-4000-8000-000000000007', 'byv', 'Medumba', 'Mə̀dʉ̂mbὰ')
on conflict (iso_code) do nothing;

insert into public.interests(id, slug, name_key, sort_order) values
  ('40000000-0000-4000-8000-000000000001', 'playdates', 'interests.playdates', 10),
  ('40000000-0000-4000-8000-000000000002', 'language', 'interests.language', 20),
  ('40000000-0000-4000-8000-000000000003', 'cooking', 'interests.cooking', 30),
  ('40000000-0000-4000-8000-000000000004', 'culture', 'interests.culture', 40),
  ('40000000-0000-4000-8000-000000000005', 'music', 'interests.music', 50),
  ('40000000-0000-4000-8000-000000000006', 'traditional-games', 'interests.traditional_games', 60),
  ('40000000-0000-4000-8000-000000000007', 'family-outings', 'interests.family_outings', 70),
  ('40000000-0000-4000-8000-000000000008', 'picnics', 'interests.picnics', 80),
  ('40000000-0000-4000-8000-000000000009', 'parent-support', 'interests.parent_support', 90),
  ('40000000-0000-4000-8000-000000000010', 'school-support', 'interests.school_support', 100),
  ('40000000-0000-4000-8000-000000000011', 'integration', 'interests.integration', 110),
  ('40000000-0000-4000-8000-000000000012', 'sports', 'interests.sports', 120),
  ('40000000-0000-4000-8000-000000000013', 'travel', 'interests.travel', 130),
  ('40000000-0000-4000-8000-000000000014', 'faith', 'interests.faith_optional', 140),
  ('40000000-0000-4000-8000-000000000015', 'arts', 'interests.arts', 150),
  ('40000000-0000-4000-8000-000000000016', 'history', 'interests.history', 160)
on conflict (slug) do nothing;

insert into kinavela_private.schema_migrations(version)
values ('202608090002_auth_family_onboarding')
on conflict (version) do nothing;

notify pgrst, 'reload schema';
commit;
