# Phase 33 — Low-density activation without access blockers

## Discovery progress when results are empty

An empty discovery result now provides direct ways to keep moving: increase the
radius up to the family's explicit maximum, clear narrow filters, search the
wider configured region, review nearby Villages, create a Village, or invite a
family through the existing WhatsApp-friendly referral flow. No town, region,
cluster or alert state is used as an admission requirement.

Broader family results are calculated with the existing deterministic matcher.
They remain subject to both families' discovery radii, visibility, active
status and blocks. Cluster signals remain aggregate suggestions for community
formation only. A Cameroon-focused Village suggestion is shown as a creation
option, never as an automatic membership or access decision.

## Compatible-family alerts

A responsible family owner can subscribe to an alert within a radius no larger
than the family's saved maximum. The subscription can be updated or revoked
from discovery at any time. Guardians cannot manage it.

The worker applies the same bilateral radius, visibility, active-profile,
block and existing-connection boundaries as discovery. A candidate is recorded
internally once per subscription for deduplication. The resulting notification
contains only a match count and radius; it contains no family, parent, child,
location or candidate identifier. Opening discovery performs the normal
authorized lookup at that time.

In-app delivery is the default. Email and web push are attempted only through
the user's existing notification-channel consent settings.

## Database security

Migration `202608130006_discovery_activation_alerts.sql` adds forced-RLS,
RPC-only subscription, match and batch tables. The owner projection returns
only subscription state and radius. The service-role worker is not executable
by browser roles, and direct table access is not granted.

`supabase/tests/0028_discovery_activation_alerts.sql` transactionally verifies
owner-only control, maximum-radius enforcement, forced RLS, bilateral location
rules, visibility, blocks, identity-free payloads, deduplication and immediate
revocation.

## Operations

The existing notification dispatcher runs the compatible-family worker before
claiming its outbox batch. No separate scheduler, waitlist processor or access
gate is introduced. Deploy the application only after running:

```bash
npm run db:migrate
npm run db:test
npm run check
npm run build
```
