import type { BillingStatus } from "@/lib/validation/billing";

/**
 * Payment grace policy: active and trialing subscriptions grant access, and
 * past_due remains entitled while Stripe retries payment. Unpaid, canceled,
 * paused and incomplete subscriptions do not grant new premium access.
 */
const ROOTS_FAMILY_ACCESS_STATUSES: readonly BillingStatus[] = [
  "active",
  "trialing",
  "past_due",
];

export function grantsRootsFamilyAccess(status: BillingStatus | string) {
  return ROOTS_FAMILY_ACCESS_STATUSES.includes(status as BillingStatus);
}
