# Production authentication and family onboarding

## Scope

Phases 1 and 2 replace the initial public-only release with a real-user account and family onboarding system. The application supports password registration, email confirmation, password login, passwordless links, account recovery, logout, protected routes, profile settings, account-deletion requests, and an atomic 11-step family onboarding flow.

## Authentication architecture

- Supabase Auth is the identity provider. Browser sessions use encrypted, `HttpOnly` auth cookies managed by `@supabase/ssr`.
- `proxy.ts` refreshes sessions and rejects unauthenticated requests to onboarding and application routes.
- Signup, magic-link and recovery emails are generated server-side and delivered through Zoho Mail Europe (`smtp.zoho.eu`).
- The service-role key is imported only by `server-only` modules. It is never placed in a `NEXT_PUBLIC_*` variable or client bundle.
- State-changing API routes require the production origin and validate payloads with Zod.
- Email/IP fingerprints are SHA-256 hashed before storage in the private rate-limit table. Identity lookup and rate-limit RPCs are executable only by `service_role`.
- Account enumeration is avoided for registration, passwordless login and recovery responses.

## Family onboarding

The onboarding wizard collects the minimum data needed to create a useful family profile: guardian display name, family details, guardian-managed child nicknames and age information, cultural roots, languages, preservation goals, interests, availability, approximate city/radius, and discovery preferences. Exact home addresses are neither requested nor stored.

`complete_family_onboarding(jsonb)` validates identity and creates the family, owner membership, children, cultural/language/interest links, availability, discovery preferences, consents and audit events in one PostgreSQL transaction. Any error rolls back the complete operation.

## Database and RLS

Migration `202608090002_auth_family_onboarding.sql` creates:

- account tables: `profiles`, `consents`, `audit_events`, `account_deletion_requests`;
- reference tables: `countries`, `cultures`, `languages`, `interests`;
- family tables: `families`, `family_members`, `children`, `family_cultures`, `family_languages`, `family_interests`, `family_availability`, `discovery_preferences`;
- private `auth_rate_limits` storage;
- auth lifecycle triggers, rate limiting, identity lookup, onboarding and account-deletion RPCs.

Every public user-data table has RLS enabled and forced. Family information is readable only by active family members. Mutation requires active owner membership. Child rows have no anonymous or public read path. Reference catalogues are the only anonymous-readable Phase 2 tables.

Database assertions in `supabase/tests/0002_auth_family_rls.sql` verify cross-family denial, owner-only mutation and the absence of anonymous family privileges. `0003_onboarding_rpc.sql` verifies atomic family, owner and child creation. Tests run inside transactions and roll back all fixtures.

## Deployment and operations

1. Validate `.env.production` with `npm run env:check`.
2. Install locked dependencies with `npm ci`.
3. Apply pending ledger-backed migrations with `npm run db:migrate`.
4. Run `npm run db:test` and `npm run check`.
5. Run `sudo ./deploy/install-root.sh` to install/restart only `kinavela.service`, validate the dedicated Nginx vhost and reload Nginx safely.
6. Verify health, authentication and onboarding through HTTPS.

The application remains isolated at `127.0.0.1:3020`; only the dedicated Nginx virtual host is public. Nginx blocks dotfiles, supplies TLS/security headers, and proxies dynamic routes and WebSocket upgrades to Kinavela.

## Recovery and privacy operations

- The Supabase project is dedicated to Kinavela and uses its managed backup capability. Before structural changes, retain a schema or project backup compatible with the server's PostgreSQL major version.
- Account-deletion requests are recorded through a security-definer RPC and audit event. They are not silently executed by the browser.
- Restore into an isolated project first, run all database assertions, then switch application credentials only after verification.
- Never commit `.env.production`, `supabaseandco_keys.txt`, database URLs, SMTP credentials, tokens or generated session cookies.
