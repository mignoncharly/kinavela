# Kinavela billing

Kinavela keeps community access free. Roots Family monetizes cultural-memory features that already exist in the application; it does not gate family discovery, matching, connection requests, private connections, basic messaging, Villages, events, RSVPs, basic Roots Passport, blocking, reporting or other core safety/community participation.

## Published plans

There is one Stripe product, **Roots Family**:

- Monthly: €5.99/month.
- Annual: €59.99/year, displayed as **Save 16%** and recommended.

The annual price is a yearly recurring Stripe Price, not a monthly price with a different label. Price IDs are environment variables and are never embedded in browser components.

## Ownership and checkout

The family is the billing owner. A family owner can start checkout or open the Stripe Customer Portal. Active guardians inherit the family entitlement but cannot manage billing. One `billing_customers` row maps a family to one Stripe Customer. Customer creation uses a family-scoped Stripe idempotency key.

Checkout accepts only `monthly` or `annual`. The server maps those names to the configured Price IDs, checks the `premium_billing` feature flag, checks for an existing relevant subscription, and creates a Stripe-hosted subscription Checkout Session. A client cannot submit a Price ID, amount, currency or entitlement.

## Entitlements

The server/database entitlement projection is the only access contract. Current Roots Family access is granted for:

- `active`
- `trialing`
- `past_due` while Stripe retries payment

Access is not granted for `incomplete`, `incomplete_expired`, `unpaid`, `paused` or `canceled`. Cancel-at-period-end subscriptions remain entitled until `current_period_end`.

The only currently gated feature is the existing Roots Stories AI workflow: audio transcription, translation and child-friendly story adaptation. The database entitlement trigger and RPC enforce this server-side. AI job quotas and cost limits remain centrally configured; the UI does not claim unlimited AI.

## Data and security

Billing tables use forced RLS, have no browser table grants, and are accessed through restricted RPCs/service-role code. Only minimized Stripe event metadata is retained. Full payment method data and raw webhook payloads are not stored by Kinavela.

## Failure recovery

Webhook failures return a non-2xx response so Stripe retries. Event rows move through `processing`, `processed` and `failed` states. Retrying a processed event is a no-op. A failed event can be claimed again safely. If a subscription is out of sync, replay its Stripe event or retrieve the current Stripe subscription and replay the relevant subscription event.
