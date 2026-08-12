# Phase 18 production runbook — SEO & public acquisition

Phase 18 adds five controlled public pages for Cameroonian families in Germany, Munich, Berlin, Frankfurt and near Ingolstadt.

## Privacy boundary

Public pages call one allowlisted aggregate RPC. The database returns counters only; it never returns family IDs, profile IDs, names, children, messages, exact locations, addresses or contact details. Counts are hidden until at least five active matching families exist. Village and event counters have their own higher thresholds.

The source query matches active family membership and a Cameroonian culture relationship (`origin`, `heritage` or `connection`) with German residence. It does not infer or publish an individual family’s identity.

## URLs and indexing

Each locale has the following routes:

- `/community/cameroonian-families-in-germany`
- `/community/cameroonian-families-in-munich`
- `/community/cameroonian-families-in-berlin`
- `/community/cameroonian-families-in-frankfurt`
- `/community/cameroonian-families-near-ingolstadt`

The sitemap includes these pages and the pages use localized canonical/hreflang metadata. The public app, auth, onboarding, admin and API surfaces remain disallowed by robots rules.

## Launch checks

1. Confirm every page shows only the generic “community is forming” state when its threshold is not met.
2. Verify the public aggregate RPC cannot be used to enumerate arbitrary cities or return private IDs.
3. Review the rendered HTML and JSON-LD/metadata for names, emails, children, coordinates and addresses before publishing.
4. Re-run `npm run db:migrate`, `npm run db:test` and `npm run check` against the production configuration.

Do not add new city pages without a documented aggregate definition and a privacy review.
