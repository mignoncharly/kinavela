begin;

create table public.cultural_mission_translations (
  mission_id uuid not null references public.cultural_missions(id) on delete cascade,
  locale text not null check (locale in ('de', 'fr', 'en')),
  content_version smallint not null check (content_version between 1 and 32767),
  source_locale text not null default 'en' check (source_locale in ('de', 'fr', 'en')),
  review_status text not null default 'needs_review'
    check (review_status in ('needs_review', 'reviewed', 'retired')),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  title text not null check (char_length(btrim(title)) between 3 and 160),
  summary text not null check (char_length(btrim(summary)) between 10 and 300),
  description text not null check (char_length(btrim(description)) between 10 and 2000),
  cultural_context text not null check (char_length(btrim(cultural_context)) between 20 and 2000),
  materials text[] not null check (cardinality(materials) between 1 and 12),
  guardian_guidance text not null check (char_length(btrim(guardian_guidance)) between 20 and 2000),
  respectful_attribution text not null check (char_length(btrim(respectful_attribution)) between 20 and 2000),
  passport_reflection_prompt text not null check (char_length(btrim(passport_reflection_prompt)) between 10 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (mission_id, locale, content_version),
  check (
    (review_status = 'reviewed' and reviewed_at is not null)
    or (review_status <> 'reviewed' and reviewed_at is null)
  )
);

create table public.mission_step_translations (
  step_id uuid not null references public.mission_steps(id) on delete cascade,
  locale text not null check (locale in ('de', 'fr', 'en')),
  content_version smallint not null check (content_version between 1 and 32767),
  source_locale text not null default 'en' check (source_locale in ('de', 'fr', 'en')),
  review_status text not null default 'needs_review'
    check (review_status in ('needs_review', 'reviewed', 'retired')),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  title text not null check (char_length(btrim(title)) between 2 and 120),
  description text not null check (char_length(btrim(description)) between 10 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (step_id, locale, content_version),
  check (
    (review_status = 'reviewed' and reviewed_at is not null)
    or (review_status <> 'reviewed' and reviewed_at is null)
  )
);

create table public.country_translations (
  country_id uuid not null references public.countries(id) on delete cascade,
  locale text not null check (locale in ('de', 'fr', 'en')),
  display_name text not null check (char_length(btrim(display_name)) between 2 and 120),
  review_status text not null default 'reviewed'
    check (review_status in ('needs_review', 'reviewed', 'retired')),
  reviewed_at timestamptz,
  primary key (country_id, locale),
  check (
    (review_status = 'reviewed' and reviewed_at is not null)
    or (review_status <> 'reviewed' and reviewed_at is null)
  )
);

create table public.culture_translations (
  culture_id uuid not null references public.cultures(id) on delete cascade,
  locale text not null check (locale in ('de', 'fr', 'en')),
  display_name text not null check (char_length(btrim(display_name)) between 2 and 120),
  review_status text not null default 'reviewed'
    check (review_status in ('needs_review', 'reviewed', 'retired')),
  reviewed_at timestamptz,
  primary key (culture_id, locale),
  check (
    (review_status = 'reviewed' and reviewed_at is not null)
    or (review_status <> 'reviewed' and reviewed_at is null)
  )
);

create table public.language_translations (
  language_id uuid not null references public.languages(id) on delete cascade,
  locale text not null check (locale in ('de', 'fr', 'en')),
  display_name text not null check (char_length(btrim(display_name)) between 2 and 120),
  review_status text not null default 'reviewed'
    check (review_status in ('needs_review', 'reviewed', 'retired')),
  reviewed_at timestamptz,
  primary key (language_id, locale),
  check (
    (review_status = 'reviewed' and reviewed_at is not null)
    or (review_status <> 'reviewed' and reviewed_at is null)
  )
);

insert into public.cultural_mission_translations (
  mission_id, locale, content_version, source_locale, review_status, reviewed_at,
  title, summary, description, cultural_context, materials, guardian_guidance,
  respectful_attribution, passport_reflection_prompt
)
select
  mission.id, 'en', mission.content_version, 'en', 'reviewed', mission.reviewed_at,
  mission.title, mission.summary, mission.description, mission.cultural_context,
  mission.materials, mission.guardian_guidance, mission.respectful_attribution,
  mission.passport_reflection_prompt
from public.cultural_missions mission
where mission.active and mission.review_status = 'reviewed'
on conflict (mission_id, locale, content_version) do nothing;

insert into public.mission_step_translations (
  step_id, locale, content_version, source_locale, review_status, reviewed_at,
  title, description
)
select
  step.id, 'en', mission.content_version, 'en', 'reviewed', mission.reviewed_at,
  step.title, step.description
from public.mission_steps step
join public.cultural_missions mission on mission.id = step.mission_id
where mission.active and mission.review_status = 'reviewed'
on conflict (step_id, locale, content_version) do nothing;

insert into public.country_translations (
  country_id, locale, display_name, review_status, reviewed_at
)
select
  country.id, locale.locale,
  case
    when country.iso2 = 'DE' and locale.locale = 'de' then 'Deutschland'
    when country.iso2 = 'DE' and locale.locale = 'fr' then 'Allemagne'
    when country.iso2 = 'CM' and locale.locale = 'de' then 'Kamerun'
    when country.iso2 = 'CM' and locale.locale = 'fr' then 'Cameroun'
    else country.name
  end,
  'reviewed', now()
from public.countries country
cross join (values ('de'), ('fr'), ('en')) as locale(locale)
on conflict (country_id, locale) do nothing;

insert into public.culture_translations (
  culture_id, locale, display_name, review_status, reviewed_at
)
select
  culture.id, locale.locale,
  case
    when culture.name = 'Cameroon' and locale.locale = 'de' then 'Kamerun'
    when culture.name = 'Cameroon' and locale.locale = 'fr' then 'Cameroun'
    when culture.name = 'Germany' and locale.locale = 'de' then 'Deutschland'
    when culture.name = 'Germany' and locale.locale = 'fr' then 'Allemagne'
    else culture.name
  end,
  'reviewed', now()
from public.cultures culture
cross join (values ('de'), ('fr'), ('en')) as locale(locale)
on conflict (culture_id, locale) do nothing;

insert into public.language_translations (
  language_id, locale, display_name, review_status, reviewed_at
)
select
  language.id, locale.locale,
  case
    when language.iso_code = 'de' and locale.locale = 'de' then 'Deutsch'
    when language.iso_code = 'de' and locale.locale = 'fr' then 'allemand'
    when language.iso_code = 'fr' and locale.locale = 'de' then 'Französisch'
    when language.iso_code = 'fr' and locale.locale = 'fr' then 'français'
    when language.iso_code = 'en' and locale.locale = 'de' then 'Englisch'
    when language.iso_code = 'en' and locale.locale = 'fr' then 'anglais'
    else language.native_name
  end,
  'reviewed', now()
from public.languages language
cross join (values ('de'), ('fr'), ('en')) as locale(locale)
on conflict (language_id, locale) do nothing;

alter table public.cultural_mission_translations enable row level security;
alter table public.mission_step_translations enable row level security;
alter table public.country_translations enable row level security;
alter table public.culture_translations enable row level security;
alter table public.language_translations enable row level security;

create policy "Authenticated families read reviewed mission translations"
  on public.cultural_mission_translations for select to authenticated
  using (review_status = 'reviewed');

create policy "Authenticated families read reviewed mission step translations"
  on public.mission_step_translations for select to authenticated
  using (review_status = 'reviewed');

create policy "Authenticated users read reviewed country translations"
  on public.country_translations for select to authenticated
  using (review_status = 'reviewed');

create policy "Authenticated users read reviewed culture translations"
  on public.culture_translations for select to authenticated
  using (review_status = 'reviewed');

create policy "Authenticated users read reviewed language translations"
  on public.language_translations for select to authenticated
  using (review_status = 'reviewed');

grant select on public.cultural_mission_translations,
  public.mission_step_translations, public.country_translations,
  public.culture_translations, public.language_translations to authenticated;

insert into kinavela_private.schema_migrations(version)
values ('202608130025_localized_cultural_content_foundation')
on conflict (version) do nothing;

notify pgrst, 'reload schema';

commit;
