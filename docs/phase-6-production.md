# Phase 6 production qualification

Phase 6 adds minimal private family messaging. Village/event chat, attachments, editing, reactions, typing state, and media remain out of scope.

## Authorization and privacy

- A family conversation can be created only for an accepted, unblocked family connection.
- Active members of either connected family can read and send; unrelated families receive no rows through RLS.
- Blocking changes the connection predicate immediately, so neither side can read history or send further messages.
- Messages are plain text, trimmed, and limited to 2,000 characters. Message content is not written to audit events or analytics.
- Sending is limited to 30 messages per minute and 500 per profile per day.
- Reports are limited to five per profile per day, use fixed reason codes, and are visible only to their reporter through application RLS.
- Insert guards lock the connection/rate key at write time, preventing concurrent send-versus-block and parallel rate-limit races.

## Realtime and unread behavior

`public.messages` belongs to the `supabase_realtime` publication. The client subscribes to `INSERT` events with a `conversation_id` filter. Message SELECT RLS authorizes delivery. Realtime events trigger refresh of the server-side RPC projection rather than trusting event payloads for display metadata.

Unread counts compare incoming-family messages with each profile participant's `last_read_at`. Opening a conversation marks it read. Muting removes/suppresses typed message notifications but leaves unread counts intact.

## Qualification commands

```bash
cd /home/mignon/apps/kinavela
npm run db:migrate
npm run db:test
npm run check
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3021 npm run test:e2e
```

After all gates pass, restart only `kinavela.service`. Verify health/readiness, unauthenticated message-route redirects, an authenticated two-family conversation, and a live insert arriving without manual reload.
