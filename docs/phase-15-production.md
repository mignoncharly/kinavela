# Phase 15 — Notifications production handoff

Phase 15 adds typed notification fan-out across in-app, email and explicitly consented web push channels.

- Existing connection, message, event-reminder, Village-chat and story-ready events feed a private notification outbox through database triggers.
- In-app entries are exposed through `/[locale]/app/notifications` and can be marked read without exposing email addresses, push endpoints or message bodies.
- Email delivery requires both the user preference and the existing `product_email` consent. Messages use generic typed copy and never include private addresses, event descriptions, story transcripts or chat content.
- Push subscription registration requires browser permission, a valid VAPID public key and server-side subscription storage.
- Production delivery uses a server-only VAPID private key, records bounded delivery health without logging endpoints, removes expired subscriptions after provider rejection, and restricts notification navigation to same-origin URLs.
- Delivery remains controlled by the `web_push_delivery` feature flag and its per-profile rollout percentage. VAPID configuration alone does not activate delivery.
- Event reminders, connection requests, Village activity and story completion are dispatched by the existing secured reminder timer, which also processes the notification outbox.

## Operational checks

```bash
npm run check
npm run db:migrate
npm run db:test
The SQL suite includes the notification RLS and production-delivery authorization assertions in `0015_notifications.sql` and `0025_notification_web_push_delivery.sql`.

```

Before enabling email in production, verify the user can opt in/out and confirm a typed delivery through Zoho.

Before enabling push:

1. Configure `NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY`, `WEB_PUSH_VAPID_PRIVATE_KEY`, and `WEB_PUSH_VAPID_SUBJECT`.
2. Rebuild the application because the public key is embedded at build time.
3. Apply migrations and database assertions.
4. Test browser permission, registration, a real delivery, same-origin navigation, revocation, and expired-subscription cleanup with synthetic data.
5. Enable `web_push_delivery` for a small rollout through the admin console and monitor failures before increasing it.
6. Update the production privacy/processor inventory for the browser push services actually used.
