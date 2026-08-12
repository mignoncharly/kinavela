# Phases 21–23 — Germany pilot, metrics and expansion

## Phase 21: pilot contract

The first release is deliberately capped at 50 active German families. The database enforces Germany-only onboarding while pilot mode is enabled and serialises the cap check to avoid race-condition oversubscription. The initial region list is Berlin, Frankfurt, Ingolstadt, Kaiserslautern, Mainz, Munich, Saarbrücken and Stuttgart; waitlist entries retain only country, city and cultural focus.

Pilot operators should recruit 20–50 Cameroon-diaspora families, verify safeguarding contacts, and review the first onboarding and connection cohort weekly. The waitlist remains available for Germany cities outside the open cohort.

## Phase 22: metrics

The admin dashboard exposes a 30-day metrics snapshot:

- onboarding completion and families with matching location;
- discovery open rate, connection request rate, acceptance rate and time to first connection;
- village formation, event creation and attendance;
- 30-day retention, Roots Passport creation and Roots Story usage;
- explicit “We met in person” confirmations after accepted connections.

Product events are first-party, authenticated and minimised. No advertising or third-party analytics is required. The decisive pilot question is whether accepted connections lead to confirmed real-world meetings; if that metric is weak, improve matching, trust and local activation before expanding.

## Phase 23: density expansion

The operator dashboard shows family and waitlist density per German city. A region can move from `waitlist` to `open` only after the configured local threshold is met and an operator reviews safety/readiness. Expansion is city-by-city; do not unlock a whole country from aggregate signups.

Operational checklist before opening a city:

1. confirm enough active families and at least one trusted local activation owner;
2. confirm moderation coverage, event venue/safety guidance and support contact;
3. review connection acceptance and meeting-confirmation quality;
4. change the region status through an authenticated admin operation and monitor the next 30 days.

The current admin readout is intentionally conservative: changing a region’s status is an operational action and should be logged before exposing a new density cohort.
