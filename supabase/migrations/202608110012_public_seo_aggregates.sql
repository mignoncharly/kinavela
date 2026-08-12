begin;

create table kinavela_private.public_seo_pages (
  slug text primary key check (slug ~ '^[a-z0-9-]{3,100}$'),
  city text,
  city_label text not null check (char_length(city_label) between 2 and 120),
  culture_country_iso2 text not null check (culture_country_iso2 ~ '^[A-Z]{2}$'),
  culture_label text not null check (char_length(culture_label) between 2 and 120),
  residence_country_iso2 text not null check (residence_country_iso2 ~ '^[A-Z]{2}$'),
  residence_label text not null check (char_length(residence_label) between 2 and 120),
  active boolean not null default true
);

insert into kinavela_private.public_seo_pages(slug, city, city_label, culture_country_iso2, culture_label, residence_country_iso2, residence_label)
values
  ('cameroonian-families-in-germany', null, 'Germany', 'CM', 'Cameroonian', 'DE', 'Germany'),
  ('cameroonian-families-in-munich', 'Munich', 'Munich', 'CM', 'Cameroonian', 'DE', 'Germany'),
  ('cameroonian-families-in-berlin', 'Berlin', 'Berlin', 'CM', 'Cameroonian', 'DE', 'Germany'),
  ('cameroonian-families-in-frankfurt', 'Frankfurt', 'Frankfurt', 'CM', 'Cameroonian', 'DE', 'Germany'),
  ('cameroonian-families-near-ingolstadt', 'Ingolstadt', 'Ingolstadt', 'CM', 'Cameroonian', 'DE', 'Germany')
on conflict (slug) do update set city = excluded.city, city_label = excluded.city_label,
  culture_country_iso2 = excluded.culture_country_iso2, culture_label = excluded.culture_label,
  residence_country_iso2 = excluded.residence_country_iso2, residence_label = excluded.residence_label,
  active = true;

revoke all on kinavela_private.public_seo_pages from public, anon, authenticated, service_role;

create or replace function public.get_public_community_aggregate(p_slug text)
returns table (
  page_slug text,
  city_label text,
  culture_label text,
  residence_label text,
  family_count integer,
  village_count integer,
  event_count integer,
  published boolean,
  last_refreshed_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with page as (
    select * from kinavela_private.public_seo_pages seo
    where seo.slug = p_slug and seo.active
  ), matching_families as (
    select distinct family.id, family.city
    from public.families family
    join public.profiles creator on creator.id = family.created_by and creator.status = 'active'
    join public.family_cultures family_culture on family_culture.family_id = family.id
    join public.cultures culture on culture.id = family_culture.culture_id
    join public.countries country on country.id = culture.country_id
    join page on page.culture_country_iso2 = country.iso2
      and page.residence_country_iso2 = family.country_of_residence
      and (page.city is null or lower(page.city) = lower(family.city))
    where family_culture.relationship_type in ('origin', 'heritage', 'connection')
      and exists (
        select 1 from public.family_members member
        where member.family_id = family.id and member.status = 'active'
      )
  ), matching_villages as (
    select distinct village.id
    from public.villages village
    join matching_families family on family.id = village.created_by_family_id
    where village.status = 'active'
  ), counts as (
    select
      (select count(*)::integer from matching_families) as families,
      (select count(*)::integer from matching_villages) as villages,
      (select count(*)::integer from public.events event join matching_villages village on village.id = event.village_id where event.status = 'scheduled') as events
  )
  select page.slug, page.city_label, page.culture_label, page.residence_label,
    case when counts.families >= 5 then counts.families else null end,
    case when counts.families >= 5 and counts.villages >= 3 then counts.villages else null end,
    case when counts.families >= 5 and counts.events >= 5 then counts.events else null end,
    counts.families >= 5,
    now()
  from page cross join counts
$$;

revoke all on function public.get_public_community_aggregate(text) from public, anon, authenticated, service_role;
grant execute on function public.get_public_community_aggregate(text) to anon, authenticated;

insert into kinavela_private.schema_migrations(version)
values ('202608110012_public_seo_aggregates')
on conflict (version) do nothing;

notify pgrst, 'reload schema';
commit;
