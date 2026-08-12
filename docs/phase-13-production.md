# Phase 13 — AI layer production handoff

Phase 13 adds the guarded AI foundation. It does not make AI an authorization, matching or safety decision-maker.

- `lib/ai/provider.ts` is a server-only provider abstraction. The default provider is disabled until an explicit adapter is configured.
- `public.ai_jobs` is an asynchronous queue with bounded retries, stale-job recovery, prompt version references, token/cost accounting, moderation status and bounded error codes.
- `kinavela_private.ai_feature_quotas` and `ai_quota_state` reserve monthly job capacity per family and feature.
- `public.ai_usage` records provider/model usage and cost without exposing it directly to browser roles.
- Successful output is always `pending_review` or `flagged`; only an owner or guardian can approve it through `review_ai_job`.
- Worker RPCs are service-role-only. Parent RPCs return reviewable output and status, never worker input, provider metadata or raw cost internals.

## Worker contract

1. Call `claim_ai_job()` with the service role.
2. Load the referenced prompt version from the private schema and call the configured provider adapter.
3. Call `complete_ai_job()` with bounded token counts, cost in micro-dollars, output, and a non-approved moderation status.
4. On provider failure, call `complete_ai_job(..., 'failed', ..., p_error_code)` with a short code only. The database retries stale processing jobs up to five attempts.
5. A guardian reviews the output through `review_ai_job()` before any product feature publishes or uses it.

The queue stores private family context for the worker, but application logs must contain only job ID, feature, status, provider/model and bounded error code. Never log prompts, transcripts, recordings, child details or generated output.

## Deploy

```bash
npm run check
npm run db:migrate
npm run db:test
```

The database test suite includes `supabase/tests/0014_ai_layer.sql` and verifies forced RLS, least-privilege worker grants, prompt versioning and privacy-safe projections.
