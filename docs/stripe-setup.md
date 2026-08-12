# Stripe setup

## Accounts and objects

Use separate Stripe test and live API keys. Never mix a key and Price ID from different modes.

The configured active objects are:

| Mode | Product                              | Monthly Price                                  | Annual Price                                   |
| ---- | ------------------------------------ | ---------------------------------------------- | ---------------------------------------------- |
| Live | `prod_V3ebmLnxqtL5Xv` — Roots Family | `price_1U3XIHL4sRcoFOy8tdm3w87i` — €5.99/month | `price_1U3XlyL4sRcoFOy8p1RKBCpa` — €59.99/year |
| Test | `prod_V3epv0eBL5FkYd` — Roots Family | `price_1U3XWCLCFNnU6PubwyXUJStB` — €5.99/month | `price_1U3Xm0LCFNnU6PublVKJB4bK` — €59.99/year |

The old annual-only products are inactive. The old live annual price cannot be archived because Stripe marks it as that inactive product's default price; it is not referenced by Kinavela.

## Production environment

Set these server-only variables in `.env.production` or the deployment secret store:

```env
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ROOTS_FAMILY_MONTHLY=price_1U3XIHL4sRcoFOy8tdm3w87i
STRIPE_PRICE_ROOTS_FAMILY_ANNUAL=price_1U3XlyL4sRcoFOy8p1RKBCpa
```

Stripe-hosted Checkout is used, so `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is not required. Never expose `STRIPE_SECRET_KEY` or `STRIPE_WEBHOOK_SECRET`.

## Webhook endpoint

Create one live-mode Stripe webhook endpoint:

`https://kinavela.gestionatech.de/api/billing/webhook`

Select only:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

The endpoint is POST-only, verifies the raw-body `Stripe-Signature` header with the five-minute tolerance, and has no user authentication requirement. Store the generated `whsec_...` only in the production environment. Configure the same path in test mode if running Stripe test-mode end-to-end tests.

## Validation procedure

1. Use test mode and an official Stripe test payment method.
2. Start one monthly checkout and one annual checkout for a controlled test family.
3. Confirm the Customer is reused and a second checkout is rejected or routed to the Portal.
4. Deliver/replay the six selected event types and verify subscription state and entitlement changes.
5. Test Portal cancellation at period end, reactivation, and a payment failure.
6. Remove test subscriptions before enabling live mode.
7. Configure the live endpoint and run a controlled production smoke test; do not leave an accidental live subscription active.
