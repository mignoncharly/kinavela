# Database

The Kinavela Supabase project is dedicated to this application. Migration `202608090001_foundation.sql` enables `pgcrypto` and PostGIS, creates a locked private migration ledger, and adds the non-sensitive `system_status` readiness marker.

`public.system_status` has forced RLS. Anonymous and authenticated roles may only select its single non-sensitive marker. All writes remain privileged. `healthcheck()` returns a boolean and exposes no topology or user data.

Apply migrations with `npm run db:migrate`; assert the deployed schema with `npm run db:test`. Never reset a production database. Every later table must ship with keys, constraints, indexes, RLS, policies, and authorization tests in the same committed migration.
