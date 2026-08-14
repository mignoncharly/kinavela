# Phase 11 — Roots Stories hardening

Phase 11 clarifies Roots Stories as a private, premium enhancement while keeping
family and Village discovery free.

## Product behavior

- Story-link creation is shown only when the guardian's family has the
  `roots_stories_ai` entitlement and the configured AI provider is ready.
- The page explains premium access and temporary provider unavailability instead
  of allowing a request that will fail later.
- Translation choices use explicit localized language names. Child-friendly
  adaptation appears only when `ai_story_adaptation` is enabled for the guardian.
- Queued, transcription, translation, adaptation, ready, and failed states are
  distinct. Failed stories offer a bounded manual retry.
- Guardians can correct the original transcript, translation, and child-friendly
  adaptation before approval. Approved stories retain the existing private Roots
  Passport publishing flow.

## Database and worker hardening

Migrations `202608130018_harden_roots_stories.sql` and
`202608130019_roots_story_adaptation_projection.sql`:

- enforces the premium entitlement when a request is created and rechecks it
  before an anonymous upload is accepted;
- validates the eight advertised translation targets;
- enforces `ai_story_adaptation` at request creation and job chaining;
- counts attempts when a job is claimed, marks terminal stale jobs failed, and
  caps guardian retries at three;
- adds audited guardian-only pre-approval text editing;
- adds private worker heartbeat/error metadata and a service-role-only recording
  function;
- keeps audio paths, AI queue rows, worker health, original audio, and generated
  text unavailable through direct client table access.

The story worker records start, completion, provider-unavailable, and claim-failed
health states. This provides a private operational signal for a stalled or
misconfigured worker without exposing provider details to families.

## Verification

- Unit contract coverage includes the expanded private story projection plus edit
  and retry actions.
- Database assertions verify entitlement/feature enforcement, worker attempt
  handling, private health data, grants, editing, auditing, and retry bounds.
