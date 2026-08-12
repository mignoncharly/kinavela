# Database

The Kinavela Supabase project is dedicated to this application. Migration `202608090001_foundation.sql` enables `pgcrypto` and PostGIS, creates a locked private migration ledger, and adds the non-sensitive `system_status` readiness marker.

`public.system_status` has forced RLS. Anonymous and authenticated roles may only select its single non-sensitive marker. All writes remain privileged. `healthcheck()` returns a boolean and exposes no topology or user data.

Apply migrations with `npm run db:migrate`; assert the deployed schema with `npm run db:test`. Never reset a production database. Every later table must ship with keys, constraints, indexes, RLS, policies, and authorization tests in the same committed migration.

Migration `202608090003_location_discovery.sql` adds the locked geocoding cache/rate-limit/provider-state tables, `discovery_blocks`, approximate-location RPCs, and the privacy-filtered `discover_families` PostGIS RPC. Migration `202608090004_phase3_rpc_grants.sql` is a forward-only least-privilege correction for Supabase-managed default function grants. Migration `202608090005_discovery_block_management.sql` adds the owner-only blocked-family management projection. Geocoding internals have forced RLS and no browser table grants. Only the service role can use provider-control RPCs; authenticated users can use onboarding, location, blocking, and discovery RPCs.

Migration `202608090006_deterministic_matching.sql` adds the private deterministic scorer and authenticated `match_families` projection. Migration `202608090007_matching_distance_type.sql` adds the explicitly locked PostGIS `double precision` adapter without changing the scoring contract. The application receives only the public projection; API roles have no schema access or execute grant for either private scorer signature.

Migration `202608090008_family_connections.sql` adds canonical family-pair connections, request-attempt limits, typed in-app notifications, the request/response/list/read RPCs, and the private accepted-connection predicate reserved for later communication authorization. All three tables have forced RLS. Authenticated roles can select only participating connection rows and their own notifications, cannot write any Phase 5 table directly, and cannot execute private helpers.

Migration `202608090009_family_messaging.sql` adds `conversations`, `conversation_participants`, `messages`, and `reports`; family messaging/read/mute/report RPCs; message notifications; rate limits; and the RLS-authorized Realtime publication entry. Migration `202608090010_messaging_conflict_target.sql` is a forward-only name-resolution correction for the conversation-list participant upsert. Migration `202608090011_messaging_insert_guards.sql` adds connection-locking insert guards that independently enforce membership, live connection state, target integrity, and concurrency-safe message/report limits. Every Phase 6 table has forced RLS, and all writes remain RPC-only.

Migration `202608090012_villages.sql` adds `villages`, `village_members`, and `village_moderation_actions`; extends conversations/reports for Village resources; and adds creation, proximity discovery, invitation, request, governance, chat, mute, report, and moderation RPCs. Migrations `202608090013`–`202608090017` are deployed forward corrections for the moderator policy wrapper, the legacy conversation constraint name, the owner-leave keyword guard, moderation-safe message tombstones, and serialized governance changes. Exact Village centers remain RPC-internal, every Village table has forced RLS, writes are RPC-only, and deleted moderated messages are hidden by message RLS while their report references remain intact.

## Phase 8

Migration `202608100001_village_events.sql` adds `events`, `event_attendees`, `event_reminder_deliveries`, and private exact event locations. It includes constraints, indexes, updated-at triggers, forced RLS, explicit grants, capacity/waitlist locking, conditional address projection, reminders, attendance, and audit RPCs. All application writes remain RPC-only.

## Phase 9

Migration `202608100003_village_discovery_engine.sql` adds the forced-RLS, RPC-only `village_cluster_responses` consent record, a private aggregate cluster detector, and owner-only list/dismiss/start routines. Candidate family identifiers and coordinates never enter the public return contract. Recommendation creation is serialized and revalidated before it delegates to `create_village`.
