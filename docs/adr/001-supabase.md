# ADR 001: Supabase backend

Status: accepted. Kinavela uses a dedicated Supabase project for PostgreSQL, Auth, Storage, and Realtime. Authorization must be enforced with RLS, not merely application sessions. Service-role credentials remain server-only.
