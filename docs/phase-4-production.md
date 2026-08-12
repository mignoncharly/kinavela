# Production deterministic matching

## Scope

Phase 4 ranks privacy-eligible discovery candidates using explicit, reproducible rules. It does not create connections, reveal contact details, add behavioral learning, or use AI.

## Execution model

`public.match_families` derives the requesting family from the authenticated profile, applies visibility, active-member, PostGIS radius, filter, and bidirectional-block rules, and then invokes the private scorer. Callers cannot submit a requester or candidate family ID to the scorer.

The private function calculates distance, closest child-age gap, set overlap for cultures/languages/interests/availability, and explicit origin/openness preferences. Requester priority settings scale the documented base weights, after which the result is normalized and rounded to 0–100. The public RPC sorts by score, distance, and UUID.

## Release checks

Apply migrations `202608090006_deterministic_matching.sql` and `202608090007_matching_distance_type.sql`, then run `npm run db:test`. The fixed fixture calls matching twice and compares complete result hashes, checks tie order, score bounds, filters, explanation keys, RPC grants, and sensitive-field absence. Run `npm run check` and Playwright before restarting `kinavela.service`.
