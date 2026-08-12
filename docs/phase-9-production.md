# Phase 9 production qualification

Phase 9 adds the consent-based Village discovery engine. It detects sufficient local family density and offers an owner a safe aggregate suggestion such as “Cameroon Families · Ingolstadt.” Listing a suggestion never creates a Village.

## Detection contract

A recommendation is eligible only when all of these conditions remain true:

- The requesting family is discoverable, has an approximate location, and has an origin or heritage culture linked to a country.
- Seven active, discoverable families sharing that origin country are mutually within their configured radii and no more than 30 km away.
- Every counted family has a child within three years of one of the requesting family's children, and the cluster represents at least three broad child age bands.
- Bidirectional blocks are excluded.
- No active Village with the same country focus exists within 30 km.
- The owner has not already dismissed or started that country recommendation.

## Authorization and privacy

The private detector has no API-role execute grant. Its authenticated projection is available only to active family owners and returns country ID/name, the requester's own city, aggregate family count, broad age bands, and the fixed radius. Candidate IDs, family names, profile data, individual distances, and coordinates are absent.

Start and dismiss requests require same-origin HTTP checks, authenticated ownership, strict application validation, and database revalidation. Starts take a country-scoped transaction lock before rechecking the cluster and delegating to the existing Village creation routine. This keeps listing side-effect free and prevents two concurrent recommendation starts from creating nearby duplicates.

## Qualification commands

```bash
cd /home/mignon/apps/gtech/kinavela
npm run db:migrate
npm run db:test
npm run check
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3021 npm run test:e2e
```

After the gates pass, restart only `kinavela.service`. With reviewed production test families, verify that six eligible families do not produce a card, the seventh does, listing creates no Village, dismissal removes the card, explicit start creates one cultural Village, and every other eligible family in the area stops receiving the recommendation. Do not create fake production families solely for deployment verification.
