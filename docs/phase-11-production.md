# Phase 11 production qualification

Phase 11 adds one private Roots Passport per child, a guardian-controlled timeline of entries, curated mission completion links, Village event references, private media storage, and an asynchronous export request boundary.

## Authorization and privacy

- Passports are created automatically for children and are never public. Only active family owners and guardians can list, create, delete, export, or attach media.
- Entries default to `private`. Explicit `family` visibility is limited to the family, and `village` visibility requires an active Village membership and a selected Village.
- Timeline projections contain the child nickname only for the authorized parent view. They never return birth data, contacts, media paths, or storage URLs.
- Photo, audio, video, and document objects live in the private `roots-media` bucket. Storage paths must begin with the authorized Passport and entry IDs; the browser cannot choose another family’s path.
- Mission and event links are revalidated in PostgreSQL. A mission must be completed by the current family, and an event must belong to a Village the family can access.
- Export requests are queued and audited; the secured privacy cron claims one job at a time, writes the private artifact, and never grants the browser service credentials.

## Qualification commands

```bash
cd /home/mignon/apps/kinavela
npm run check
npm run db:migrate
npm run db:test
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3021 npm run test:e2e
```

With reviewed test families, verify one Passport is created for each child, guardians can create and delete entries, family members cannot mutate them, private entries are not visible to another family, completed missions can be added, media uploads reject oversized or unsupported files, and export requests remain queued without exposing a file path.
