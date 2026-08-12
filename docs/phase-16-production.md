# Phase 16 production runbook — Admin & moderation

Phase 16 adds the minimum operational control plane required before launch: report review, account suspension and restoration, safe operational views for users/families/villages/events, AI job monitoring, feature flags and an append-only audit trail.

## Bootstrap the first administrator

The migration intentionally creates no administrator. After identifying the target profile through a trusted, privacy-safe process, run the following with the Supabase `service_role` connection only:

```sql
select public.grant_admin_role('<profile-id>', 'admin');
```

The function is not executable by `anon` or `authenticated`. Do not place the service-role key in the browser, an API route, a CI log or a support ticket.

## Operating the console

Open `/<locale>/admin` with an active admin or moderator account. The console provides report status transitions, suspension/restoration for non-admin profiles, safe projections for users/families/villages/events, AI job monitoring, feature flags and recent audit events.

The UI deliberately excludes auth identifiers, email addresses, family coordinates, village center locations, event addresses, child data, message bodies and raw AI input/output. Sensitive evidence remains behind scoped access and documented moderation procedures.

## Launch checks

Before production launch:

1. Verify at least two people can access the console, with one admin and one moderator role.
2. Submit a test report and confirm the status transition creates an audit event.
3. Suspend a test account and confirm protected routes redirect to the suspension page; restore it afterward.
4. Confirm `web_push_delivery` and `notifications_email` remain disabled until their providers and delivery monitoring are configured.
5. Confirm `npm run db:migrate` and `npm run db:test` run against the remote Supabase project and include `0016_admin_moderation.sql`.
6. Review [security.md](security.md) and [backup-recovery.md](backup-recovery.md).

No production launch is approved without a staffed moderation path and a tested suspension path.
