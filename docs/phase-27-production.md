# Phase 27 — Story audio transcription worker

Phase E completes the missing Story AI worker contract. It claims private
story_ai_jobs rows with a service-role-only RPC, downloads the audio directly
from the private story-audio bucket, sends the file to OpenAI transcription,
and advances the existing sequence:

    transcribe -> optional translate -> adapt -> guardian review

## Delivered

- claim_story_ai_job() with stale-job recovery, row locking, bounded retries,
  service-role-only execution, and no browser-visible storage path.
- A dedicated /api/cron/story-ai worker for transcription, translation, and
  adaptation.
- OpenAI gpt-4o-transcribe as the default transcription model.
- A 25 MB server, database, Storage, and upload limit aligned with the
  transcription API.
- Dedicated hardened systemd service and timer.

The worker never forwards a signed URL or accepts a browser-supplied URL. It
downloads only the path returned by the privileged claim RPC. It records no
audio, transcript, child detail, prompt, or generated output in logs.

## Enablement

The AI provider, worker secret, and AI_PROCESSING_APPROVED=true are now configured in the ignored production environment. The workers remain gated by the same server-side approval and must be enabled by the reviewed systemd installer after each environment change.

After enabling or changing the provider, run:

    npm run env:check
    npm run check
    npm run db:migrate
    npm run db:test

Then invoke the authenticated /api/cron/story-ai loopback endpoint with a
synthetic fixture and verify the worker timer status.
