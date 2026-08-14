# Phase 29 — Germany-wide family access

## Access contract

Any authenticated family selecting a valid, unexpired geocoded place in
Germany may complete onboarding and change its location immediately. A city,
town, village, municipality, postcode-derived place, family count, regional
density, or historical pilot status must never control admission.

The database enforces the launch-country boundary from the server-side
geocoding cache, not from client-submitted country or city text. The public
onboarding path is `complete_family_onboarding_with_location`; authenticated
access to the older non-geocoded onboarding routine is revoked.

## Retired controls

Migration `202608130001_germany_wide_access.sql` permanently removes the
family admission trigger and its pilot-location/cap functions. It also removes
the pilot-region status mutation RPC and revokes the waitlist RPCs. Re-enabling
the historical `pilot_settings` row or changing a retained `pilot_regions`
record cannot restore blocking because no admission code reads either table.

Historical waitlist records remain private for restricted rollback review. Phase 14 copies them into a bounded 180-day archive, migrates active accounts, and replaces admission-era fields with de-identified regional outreach totals. See [Phase 14](phase-14-legacy-cleanup.md).

## Location and errors

Location search continues to accept geocoder address fields in this order:
city, town, village, municipality, county, then the provider display label.
Numeric German postcode queries are supported by the same opaque-place-ID
flow. Exact addresses and device coordinates are neither requested nor stored.

The application distinguishes invalid/expired places, places outside Germany,
temporary geocoder failure, authentication failure, and validation failure.
Location search failure copy is available in German, French, and English.

## Release verification

Before deployment:

1. apply the forward migration and reload the API schema;
2. run `npm run db:test` and the application quality gates;
3. onboard with an unconfigured German municipality and a German postcode;
4. move an existing family between two German municipalities;
5. verify a cached non-German place returns `germany_location_required`;
6. verify no waitlist or region-status action appears in onboarding/admin;
7. confirm retained waitlist data remains unavailable to browser roles.

Database tests deliberately set the old pilot row back to enabled, mark a
region paused, create more families than the old cap, and then onboard new
families. This guards against accidental reintroduction of admission blocking.
