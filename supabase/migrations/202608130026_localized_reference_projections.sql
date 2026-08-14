begin;

create or replace function public.list_localized_countries(p_locale text, p_iso2 text default null)
returns table (id uuid, iso2 text, name text, emoji text)
language sql stable security definer set search_path = ''
as $$
  select country.id, country.iso2, translation.display_name, country.emoji
  from public.countries country
  join public.country_translations translation
    on translation.country_id = country.id
   and translation.locale = p_locale
   and translation.review_status = 'reviewed'
  where p_locale in ('de', 'fr', 'en')
    and (p_iso2 is null or country.iso2 = p_iso2)
  order by translation.display_name, country.id;
$$;

create or replace function public.list_localized_cultures(p_locale text)
returns table (id uuid, name text)
language sql stable security definer set search_path = ''
as $$
  select culture.id, translation.display_name
  from public.cultures culture
  join public.culture_translations translation
    on translation.culture_id = culture.id
   and translation.locale = p_locale
   and translation.review_status = 'reviewed'
  where p_locale in ('de', 'fr', 'en')
  order by translation.display_name, culture.id;
$$;

create or replace function public.list_localized_languages(p_locale text)
returns table (id uuid, name text)
language sql stable security definer set search_path = ''
as $$
  select language.id, translation.display_name
  from public.languages language
  join public.language_translations translation
    on translation.language_id = language.id
   and translation.locale = p_locale
   and translation.review_status = 'reviewed'
  where p_locale in ('de', 'fr', 'en')
  order by translation.display_name, language.id;
$$;

revoke all on function public.list_localized_countries(text, text),
  public.list_localized_cultures(text), public.list_localized_languages(text)
  from public, anon, service_role;
grant execute on function public.list_localized_countries(text, text),
  public.list_localized_cultures(text), public.list_localized_languages(text)
  to authenticated;

insert into kinavela_private.schema_migrations(version)
values ('202608130026_localized_reference_projections')
on conflict (version) do nothing;

notify pgrst, 'reload schema';

commit;
