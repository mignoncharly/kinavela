import { z } from "zod";

export const billingPlanSchema = z.enum(["monthly", "annual"]);

export const billingStatusSchema = z.enum([
  "free",
  "incomplete",
  "incomplete_expired",
  "trialing",
  "active",
  "past_due",
  "canceled",
  "unpaid",
  "paused",
]);

export const billingCheckoutSchema = z
  .object({ plan: billingPlanSchema })
  .strict();

export const billingEntitlementsSchema = z
  .object({
    plan: billingPlanSchema.or(z.literal("free")),
    status: billingStatusSchema,
    has_billing_customer: z.boolean(),
    roots_stories_ai: z.boolean(),
    current_period_end: z.string().datetime({ offset: true }).nullable(),
    cancel_at_period_end: z.boolean(),
  })
  .strict();

export type BillingPlan = z.infer<typeof billingPlanSchema>;
export type BillingEntitlements = z.infer<typeof billingEntitlementsSchema>;
export type BillingStatus = z.infer<typeof billingStatusSchema>;
