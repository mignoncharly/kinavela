# Phase 17 production runbook — Billing

Phase 17 adds Stripe Checkout, the Stripe customer portal, signed webhook processing, subscription synchronization, family entitlements and premium AI gates. Community access remains useful without payment.

## Configuration

Configure these server-only values in production:

- `STRIPE_SECRET_KEY` (`sk_...`)
- `STRIPE_WEBHOOK_SECRET` (`whsec_...`)
- `STRIPE_PRICE_ROOTS_FAMILY_MONTHLY` (`price_...`)
- `STRIPE_PRICE_ROOTS_FAMILY_ANNUAL` (`price_...`)

`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is optional because the current flow uses Stripe-hosted Checkout and does not collect card data in Kinavela. Never expose the secret key or webhook secret.

Create a Stripe webhook endpoint at `/api/billing/webhook` for:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

The webhook signature is verified with a five-minute timestamp tolerance. Minimized event metadata is recorded by Stripe event ID before processing, and processing states allow safe retries after failures.

## Product behavior

The free tier keeps family profiles, discovery, connections, Villages, basic events and the basic Roots Passport available. A current `roots_family` subscription grants the existing Roots Stories AI workflow: audio transcription, translation and child-friendly story adaptation. No planned or unimplemented feature is exposed as an entitlement.

The browser can request only `monthly` or `annual`. Price IDs and amounts are selected on the server. Entitlements are derived from webhook-synchronized subscription state; client-side flags are never trusted.

## Launch checks

1. The `premium_billing` feature flag is enabled only after the live keys, prices, webhook delivery, Portal and smoke tests are complete.
2. Test Checkout in Stripe test mode and verify a family customer is created once.
3. Replay the same webhook and confirm no duplicate subscription event is created.
4. Test renewal, payment failure, cancellation and portal access.
5. Confirm an unsubscribed family receives `premium_entitlement_required` for Roots Stories AI while free features continue working.
6. Run `npm run db:migrate` and `npm run db:test` against the remote Supabase project.
