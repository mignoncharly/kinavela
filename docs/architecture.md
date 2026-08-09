# Architecture

Kinavela Phase 0 is a Next.js App Router application running as a dedicated Node.js process on loopback port 3020. Nginx terminates TLS and proxies only the Kinavela hostname to that port. Supabase provides the separate managed PostgreSQL/Auth/Storage platform; only the database health contract is enabled in this phase.

Public pages use Server Components and static generation. Interactive browser code receives only the Supabase project URL and publishable key. Server-only modules are guarded with `server-only`. Environment validation fails startup when required production configuration is missing.

The application is structured around `app/`, `components/`, `lib/`, `supabase/`, `tests/`, `deploy/`, and `docs/`. Future domain features belong in `features/` and must be implemented one blueprint phase at a time.
