# Production location and discovery

## Scope

Phase 3 adds approximate city geolocation and privacy-safe family discovery. It deliberately does not add weighted matching scores, connection requests, private contact visibility, or messaging.

## Geocoding

City/postcode search is authenticated and server-side. Input cannot contain street-address syntax. The application uses a configurable `GEOCODING_BASE_URL`, identifies itself upstream, enforces ten searches per client per minute and one application-wide upstream request per second, and caches results for 30 days. The UI performs search only after an explicit action and displays OpenStreetMap attribution.

The browser receives an opaque provider place ID plus display labels. Onboarding and later location changes resolve that ID from the locked cache inside PostgreSQL; clients cannot directly write coordinates. Only the selected place centre is stored, with `location_precision = city`.

## Discovery and privacy

`discover_families` derives the requester from `auth.uid()`. It applies the requester's configured radius, the candidate's radius, optional filters, discoverable visibility, and bidirectional blocks. Its explicit projection contains family name, approximate city area, distance bucket, coarse child age ranges, culture/language labels, shared interest slugs, and factual reason keys.

It never returns latitude/longitude, address/postcode, contact details, child names, exact birth data, or direct child records. Direct RLS policies on family and child tables remain unchanged and private.

## Operations

Apply all Phase 3 migrations in order and run `npm run db:test`. The grants migration intentionally corrects provider-managed default function grants and must not be squashed out of an already deployed environment. Before broader traffic, configure a dedicated or commercial geocoder endpoint and verify its privacy/retention terms.
