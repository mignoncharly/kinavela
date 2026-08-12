# Phase 12 — Roots Stories production handoff

Phase 12 adds a private story workflow for Roots Passport:

- a parent creates a seven-day, single-purpose recording request;
- only a SHA-256 token digest is stored in `story_requests`;
- an anonymous grandparent or trusted relative can record or upload audio without an account;
- audio is stored in the private `story-audio` bucket and is never exposed as a storage path;
- queued transcription, translation and child-friendly adaptation jobs move the story to review;
- a parent approves or rejects the result, then can add the approved story to the child’s Roots Passport.

## Deploy

Run the normal production checks with the production environment loaded:

```bash
npm run check
npm run db:migrate
npm run db:test
```

`db:migrate` applies the Roots Stories migration and its follow-up constraint/worker-grant migrations (`202608110005_roots_stories_constraints` and `202608110006_roots_stories_worker_grant`) when they are not already recorded. `db:test` includes `supabase/tests/0013_roots_stories.sql`.

## AI worker contract

The application intentionally does not call an AI provider from the browser or from an anonymous route. A trusted worker claims a `story_ai_jobs` row and calls `complete_story_ai_job` with the service role. The RPC advances only the allowed sequence (`transcribe` → optional `translate` → `adapt`), stores bounded error codes, and marks the story ready for human approval.

## Privacy checks

The story tables use forced RLS and have no direct `anon` or `authenticated` table privileges. Parent projections omit token digests, storage paths, family IDs and unrelated child details. Anonymous projections contain only the request prompt and expiry. Audio is delivered to an authorized parent through a five-minute signed URL.

Never put the raw recording token in logs, analytics, database rows or support screenshots. Revoke a request if it is shared incorrectly; expiry and the access/recording limits are enforced by the database.
