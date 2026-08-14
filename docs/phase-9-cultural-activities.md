# Phase 9 — Complete cultural activities

This phase implements Phase 9 of `new_implementation_plan.md` with ten
reviewed, Cameroon-linked family missions. The catalogue now covers traditional
games, folktales, history, geography, music and movement, celebrations, family
values, language practice, recipes, and elder heritage.

## Editorial and cultural-scope contract

Every published mission now requires:

- cultural context and an explicit country, community, or family scope;
- an age range, time estimate, materials and guardian guidance;
- one to twenty concrete steps;
- respectful source attribution;
- a Roots Passport reflection prompt;
- a reviewed status, review time and content version.

Unreviewed legacy or operator-created content is retained but unpublished. The
catalogue RPCs return only active, reviewed missions.

The seeded catalogue distinguishes country-level Cameroon activities from
Bamiléké, Bassa, Beti and Duala family-led contexts. It does not claim that a
single recipe, game, story, language, value or celebration represents all
Cameroonians or every member of a named community. Community-specific missions
ask families to work from a trusted speaker, storyteller, elder or household
source and preserve the source's consent and sharing boundaries.

## Product behavior

Mission cards display cultural scope and context before the steps. Families can
expand materials, safeguarding guidance and attribution notes. Completing a
mission reveals its reflection prompt, ready to be used when the experience is
saved in a child's private Roots Passport.

Mission progress remains a family resource managed by owners and guardians.
Village assignments retain their active-membership and owner/organizer checks.
No child identity, contact detail, location or private family content enters the
catalogue projection.

## Deployment and verification

Apply migration `202608130016_complete_cultural_missions.sql`, then run
`npm run db:test`, `npm test`, `npm run typecheck`, `npm run lint`,
`npm run security:scan`, and `npm run build`.

Database assertion `0032_complete_cultural_missions.sql` verifies catalogue
coverage, reviewed-content completeness, community-specific scope, least
privilege and projection privacy.
