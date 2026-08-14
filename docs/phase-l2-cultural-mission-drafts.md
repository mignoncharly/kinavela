# Phase L2 — Cultural mission translation drafts

## Status

German and French editorial drafts were approved on 13 August 2026. The approval
migration is additive and records a timestamp for every mission and step
translation; locale-specific RPCs now serve only reviewed content.

## Draft content

`supabase/migrations/202608130027_cultural_mission_translation_drafts.sql`
created one `needs_review` record for each of the following mission/locale pairs
and for each of their four steps. Migration `202608130028` promotes exactly this
approved content set to `reviewed`:

- `five-greetings-from-cameroon`
- `family-recipe-table`
- `map-a-family-journey`
- `family-song-and-rhythm`
- `teach-a-family-game`
- `bassa-family-folktale`
- `cameroon-history-family-timeline`
- `bamileke-family-celebration`
- `beti-words-and-family-values`
- `grandparent-heritage-interview`

That is 20 mission translations and 80 step translations. Every draft carries
the current English mission content version and `source_locale = 'en'`.

## Delivery safeguards

The draft migration reset every seeded record to `needs_review`, with both
`reviewed_at` and `reviewed_by` set to `NULL`. Approval is recorded separately;
the reviewer is external to the application and is therefore not represented by
a fabricated profile ID. RLS permits authenticated families to select only
`reviewed` rows. The locale-specific mission RPCs require `de`, `fr`, or `en`,
return only the requested reviewed locale, and omit a mission with a missing
reviewed step translation. IndexedDB snapshots are tagged with that locale and
are never shown under another interface locale.

Migrations `202608130030` and `202608130031` force RLS on all localized-content
tables and revoke inherited anonymous, public, and service-role table access.
Only authenticated users retain direct reviewed-content reads; the application
uses protected RPCs for locale-specific delivery.

## Reviewer checklist

For every German and French mission, review the title, summary, description,
cultural context, materials, guardian guidance, attribution instruction,
reflection prompt, and all four steps. Confirm in particular that the wording:

- preserves the source's distinction between country, community, and family;
- retains consent, privacy, safeguarding, and age-appropriateness boundaries;
- does not turn Duala, Bassa, Bamiléké, Beti, or a family's practice into a
  universal Cameroonian claim;
- uses a locally understandable but respectful German or French reading level;
- preserves culturally specific names unless the reviewer provides an accepted
  editorial alternative.

Record the reviewer identity, date, locale, mission slug, content version, and
approval decision. Corrections must be made in a follow-up additive migration;
do not edit an already applied migration.

## Verification completed before review

- Parsed the seed payload: 20 mission drafts and 80 step drafts; every mission
  has a German and French record and positions 1–4.
- `npm run i18n:check`
- `npm test -- tests/unit/localization-foundation.test.ts tests/unit/missions.test.ts`
- `git diff --check`

`supabase/tests/0040_cultural_mission_translation_drafts.sql` verifies the draft
state once migrations are applied to a non-production database. It verifies every
published mission and step has German and French content, that a draft has no
review evidence, and that any later reviewed record has a review timestamp.

## Production deployment verification

On 13 August 2026, migrations `202608130025` through `202608130031` were applied
to the configured Supabase project. `npm run db:test` then passed in full.
