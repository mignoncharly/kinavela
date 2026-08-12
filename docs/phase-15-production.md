# Phase 15 — Notifications production handoff

Phase 15 adds typed notification fan-out across in-app, email and explicitly consented web push channels.

- Existing connection, message, event-reminder, Village-chat and story-ready events feed a private notification outbox through database triggers.
- In-app entries are exposed through `/[locale]/app/notifications` and can be marked read without exposing email addresses, push endpoints or message bodies.
- Email delivery requires both the user preference and the existing `product_email` consent. Messages use generic typed copy and never include private addresses, event descriptions, story transcripts or chat content.
- Push subscription registration requires browser permission, a valid VAPID public key and server-side subscription storage. The worker already handles display/click routing; the delivery adapter remains disabled until a reviewed Web Push provider is configured.
- Event reminders, connection requests, Village activity and story completion are all dispatched by the existing secured reminder timer, which now also processes the notification outbox.

## Operational checks

```bash
npm run check
npm run db:migrate
npm run db:test
```

The SQL suite includes `supabase/tests/0015_notifications.sql`, which checks forced RLS, authenticated-only preference/feed RPCs, service-role-only delivery claims, privacy-safe projections and activity triggers.

Before enabling email in production, verify the user can opt in/out and confirm a typed delivery through Zoho. Before enabling push, configure `NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY`, install the reviewed server delivery adapter, test browser permission/revocation, and verify expired subscriptions are removed after provider rejection.
