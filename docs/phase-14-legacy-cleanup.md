# Phase 14: data migration and legacy cleanup

Phase 14 retires the remaining pilot-era data and terminology without dropping
historical tables or losing rollback evidence.

## Migration behavior

Migration `202608130024_legacy_pilot_cleanup.sql` defensively removes every
legacy admission trigger, function, and region-status write RPC before touching
historical data. The disabled settings and region tables remain for rollback
review but are no longer read by onboarding, location changes, or active admin
screens.

Each retained `pilot_waitlist` row is copied into the private
`legacy_waitlist_archive` with its original state and one outcome:

- `active_family` for a completed active family;
- `onboarding_invited` for an active account that still needs onboarding;
- `inactive_account` for suspended or deleted accounts.

Active profiles receive an identity-free in-app notice that Germany-wide access
is available. Email and push rows are created only when the existing preference,
consent, feature-flag, and device requirements allow those channels. No email,
child, address, message, or location-detail data enters the payload.

## Retention and rollback

The identifiable archive is private, has no browser grants, and is retained for
180 days. The daily privacy cron invokes `purge_legacy_pilot_data` to remove both
the archived copy and its migrated source row after that window. Logical account
deletion removes the profile's archive immediately.

City-level historical interest is separately aggregated without profile or
family identifiers. Its two-year review policy supports outreach planning, not
admission. Historical tables are deliberately not dropped in this phase.

## Operations terminology

The active admin contracts are now:

- `admin_list_product_metrics` for product-health measurements;
- `admin_list_regional_outreach` for discoverable-family density and
  de-identified historical interest.

The projection has no waiting, threshold, rollout, status, or region-control
fields. The old pilot metrics and regional density RPC names are removed.

## Rollback

Database migrations remain forward-only. During the 180-day rollback window, a
reviewed compensating migration may use `legacy_waitlist_archive` to reconstruct
the original waitlist state. It must not restore any admission trigger, city
allowlist, regional status gate, or family cap.

## Verification

Run:

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run security:scan
npm run build
npm run db:migrate
npm run db:test
```
