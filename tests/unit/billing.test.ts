import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { grantsRootsFamilyAccess } from "@/lib/billing/access";
import {
  ROOTS_FAMILY_ANNUAL_SAVING_PERCENT,
  ROOTS_FAMILY_PRICING,
} from "@/lib/billing/pricing";
import {
  billingCheckoutSchema,
  billingEntitlementsSchema,
} from "@/lib/validation/billing";

describe("Billing contracts", () => {
  it("accepts only server-mapped plan names", () => {
    expect(billingCheckoutSchema.safeParse({ plan: "monthly" }).success).toBe(
      true,
    );
    expect(
      billingCheckoutSchema.safeParse({
        plan: "annual",
        price_id: "price_client_override",
      }).success,
    ).toBe(false);
    expect(billingCheckoutSchema.safeParse({ plan: "price_123" }).success).toBe(
      false,
    );
  });

  it("keeps entitlement responses free-safe and Stripe-private", () => {
    expect(
      billingEntitlementsSchema.safeParse({
        plan: "free",
        status: "free",
        has_billing_customer: false,
        roots_stories_ai: false,
        current_period_end: null,
        cancel_at_period_end: false,
      }).success,
    ).toBe(true);
    expect(
      billingEntitlementsSchema.safeParse({
        plan: "free",
        status: "free",
        has_billing_customer: false,
        roots_stories_ai: false,
        current_period_end: null,
        cancel_at_period_end: false,
        stripe_customer_id: "cus_secret",
      }).success,
    ).toBe(false);
  });

  it("maps the published plans and payment grace policy", () => {
    expect(ROOTS_FAMILY_PRICING.monthly.amountCents).toBe(599);
    expect(ROOTS_FAMILY_PRICING.annual.amountCents).toBe(5999);
    expect(ROOTS_FAMILY_PRICING.annual.interval).toBe("year");
    expect(ROOTS_FAMILY_ANNUAL_SAVING_PERCENT).toBe(16);
    expect(grantsRootsFamilyAccess("active")).toBe(true);
    expect(grantsRootsFamilyAccess("past_due")).toBe(true);
    expect(grantsRootsFamilyAccess("canceled")).toBe(false);
    expect(grantsRootsFamilyAccess("unpaid")).toBe(false);
  });

  it("produces the Stripe webhook signing input format", () => {
    const secret = "whsec_test";
    const timestamp = "1760000000";
    const payload = '{"id":"evt_test"}';
    const signature = createHmac("sha256", secret)
      .update(`${timestamp}.${payload}`)
      .digest("hex");
    expect(signature).toMatch(/^[a-f0-9]{64}$/);
  });
});
