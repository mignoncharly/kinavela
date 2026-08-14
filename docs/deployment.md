# Production deployment

## Topology

- Project: `/home/mignon/apps/kinavela`
- Process: `kinavela.service`
- Loopback listener: `127.0.0.1:3020`
- Hostname: `www.kinavela.com`
- Nginx site: `/etc/nginx/sites-available/kinavela`
- Logs: `/var/log/kinavela/`, Nginx logs prefixed `kinavela`
- Secrets: `.env.production` mode `0600`, never committed
- Geocoder: server-side `GEOCODING_BASE_URL` (defaults to the server-side Nominatim endpoint)

## First install

Run quality gates and migration as the application user, then execute `sudo ./deploy/install-root.sh`. The installer is limited to Kinavela targets. It backs up an existing exact service/site file, checks port 3020, creates the dedicated `/var/log/kinavela` directory, installs the service and HTTP challenge vhost, validates Nginx, obtains a hostname-specific Certbot certificate, installs the TLS vhost, validates again, and performs a readiness request. It also installs and enables the daily `kinavela-privacy.timer`, which invokes the secured privacy cron for exports, account deletion and retention cleanup.

## Update

Fetch reviewed source, run `npm ci`, `npm run db:migrate`, `npm run check`, and `npm run build`; then run `sudo systemctl restart kinavela.service`. Validate `/api/health`, `/api/readiness`, service status, logs, and HTTPS. Never restart unrelated units.

For Phase 30, verify owner-only family settings, multiple languages and availability slots, child removal confirmation and Roots-history protection, matching changes after edits, and geocoded family/profile city synchronization. Confirm guardians and ordinary members cannot mutate the family profile.

For Phase 3, also verify an authenticated manual city search, OpenStreetMap attribution, a location save, and a privacy-safe discovery response. Monitor upstream geocoding limits; move to a dedicated or commercial endpoint before traffic exceeds the public-service policy.

For Phase 5, verify request, incoming notification, recipient acceptance, accepted-only bio/guardian visibility, decline, and block flows with two test families. Confirm an unauthenticated `/de/app/connections` request redirects to login and that blocking an accepted family immediately makes `are_families_connected` false. Do not enable Phase 6 messaging unless every write checks that predicate.

For Phase 6, verify conversation creation only after acceptance, bidirectional message delivery, Realtime refresh, unread/read transitions, mute notification suppression, family/message reporting, and immediate access revocation after block. Confirm `messages` remains in the `supabase_realtime` publication and watch Realtime channel errors and database replication lag. Message content must never appear in application audit logs or analytics.

For Phase 7, verify Village creation, a connected-family invitation, a nearby-family join request, three active families, role assignment, owner transfer guard, Village chat Realtime refresh, mute/report/moderation, leave, and member removal. Confirm removed and unrelated families cannot open the Village or read its messages, and no Village RPC returns center coordinates.

## Rollback

Check out the previous Kinavela commit, run `npm ci` and `npm run build`, then restart only `kinavela.service`. Database migrations are forward-only; write a reviewed compensating migration instead of resetting production.

## Phase 8 reminders

Set a unique 32+ character `EVENT_REMINDER_CRON_SECRET` in each server environment. The installer deploys and enables `kinavela-event-reminders.service` and `kinavela-event-reminders.timer`. After an update, verify `systemctl status kinavela-event-reminders.timer` and invoke one authenticated loopback reminder request before relying on scheduled delivery. Never place the token in a `NEXT_PUBLIC_` variable.

For AI, set `AI_PROVIDER=openai`, the server-only OpenAI key, `AI_WORKER_CRON_SECRET`, and `AI_PROCESSING_APPROVED=true` only after the provider transfer/DPA review is recorded. The installer enables `kinavela-ai-worker.timer` only when the provider is explicitly enabled. The worker processes at most five jobs per minute and stores only bounded provider metadata and reviewable output.

## Stripe activation

Before restarting Kinavela with billing enabled, apply migrations, configure the live secret and the two live Roots Family Price IDs, create the live webhook endpoint at `https://www.kinavela.com/api/billing/webhook`, and store its `whsec_...` secret in `.env.production`. Select only the six events documented in `docs/stripe-setup.md`. Run `npm run env:check`, `npm run check`, `npm run db:migrate` and `npm run db:test` before enabling the `premium_billing` flag. Restart only `kinavela.service`, then verify the webhook, settings billing panel, Portal and cancel-at-period-end state.

## Phase 14 legacy cleanup

Apply migration `202608130024_legacy_pilot_cleanup.sql` before deploying application code that calls the renamed product-health and regional-outreach RPCs. Record aggregate source and archive counts without logging profile identifiers. Confirm the migration queues only consent-eligible optional channels and that `kinavela-privacy.timer` invokes both normal retention and `purge_legacy_pilot_data`.

The database rollback window is 180 days. Use only a reviewed forward compensating migration and the private archive; never recreate an admission trigger, regional write control, city allowlist, or family cap. After the window, confirm the source and archive rows are purged while de-identified regional totals remain available for outreach review.

## Phase 15 release qualification

Run `npm run release:qualification` before deploying a candidate. This includes the rollback-safe Schrobenhausen acceptance journey and the Android Chrome, iOS Safari and desktop browser projects. Set `SMOKE_BASE_URL=https://www.kinavela.com` to include public HTTPS smoke checks. A failed functional, security, database or browser criterion blocks release and must not be bypassed with city, region or family-cap administration.
