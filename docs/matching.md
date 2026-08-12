# Matching

Phase 4 uses a deterministic PostgreSQL scorer. `match_families` derives the requester from `auth.uid()`, finds privacy-eligible candidates, calculates each score with `kinavela_private.calculate_family_match`, and orders by score descending, internal distance ascending, then family UUID ascending. Identical database state and inputs therefore produce identical output.

## Component scores

- Distance: linear from 100 at the same place centre to 0 at the effective radius.
- Child age: 100 minus 20 points per year of the closest cross-family child-age gap, floored at zero.
- Culture, language, interests, and availability: Jaccard overlap (`intersection / union * 100`).
- Stated preferences: 100 for a shared self-described origin country, 75 when both families are open to all diaspora families, 50 when both selected other-African-family openness, otherwise zero. No ethnicity or continent is inferred.

Base weights are distance 25, child age 20, culture 15, language 10, interests 15, availability 10, and stated preferences 5. Except for distance, each base weight is scaled by the requester's corresponding explicit priority from zero to five. The weighted total is normalized back to 0–100 and rounded once.

Explanations are deterministic keys derived from the same components: similar child ages, shared culture/language/interests, overlapping availability, shared origin country, and proximity. The UI localizes these keys. AI and behavioral signals do not participate.

The RPC returns only the score, distance bucket, coarse child age bands, display city area, culture/language labels, shared interests, and explanation keys. It never returns coordinates, street/postcode, private contact details, child names, exact birth data, or internal component values. Bidirectional blocks are applied before scoring.
