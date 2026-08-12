# Phase 26 — OpenAI provider and AI worker

Phase 26 connects the existing reviewable AI queue to a server-only OpenAI
Responses API adapter. The current production environment has the provider,
worker secret, and explicit controller-processing approval configured server-side.

## Delivered

- lib/ai/provider.ts implements the OpenAI Responses API adapter with
  store: false, bounded output, explicit reasoning effort, JSON-safe output,
  bounded error codes, and token/cost accounting.
- app/api/cron/ai claims and completes at most five service-role AI jobs per
  invocation. Prompts, context, recordings, generated output, and credentials
  are never written to logs or returned by the worker endpoint.
- AI job creation returns 503 while the provider is disabled or transfer
  approval is missing, preventing jobs from being stranded in the queue.
- The worker is scheduled by hardened systemd units only when
  AI_PROVIDER=openai is explicitly enabled.
- The default production values are gpt-5.6-terra, medium reasoning, and
  2,048 output tokens. Database quotas remain the final per-family cost and
  job limit.

## Supported scope

The text adapter handles translation, adaptation, and other reviewable text features. Phase E adds a separate Story worker for private audio transcription. The worker downloads only the Storage path returned by the service-role claim RPC, enforces the 25 MB limit, sends the file to the transcription endpoint, and never accepts an audio URL from the browser.

## Enablement gate

Set the following only after recording the provider transfer/DPA review and
controller approval:

    AI_PROVIDER=openai
    OPENAI_API_KEY=<server-only key>
    OPENAI_MODEL=gpt-5.6-terra
    AI_REASONING_EFFORT=medium
    AI_MAX_OUTPUT_TOKENS=2048
    AI_PROCESSING_APPROVED=true
    AI_WORKER_CRON_SECRET=<32+ random characters>

The key must not use a NEXT_PUBLIC_ name and must not be copied into source
control. Run npm run env:check, npm run check, npm run db:migrate,
npm run db:test, and one authenticated loopback worker smoke request after
the service restart. A real provider request should use synthetic, non-family
data until the legal/data-processing gate is approved.
