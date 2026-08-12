import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { publicEnv } from "@/lib/env.public";
import { serverEnv } from "@/lib/env.server";
import type { BillingPlan } from "@/lib/validation/billing";

type StripeResponse = Record<string, unknown>;

export class StripeConfigurationError extends Error {}
export class StripeRequestError extends Error {}

export function stripeConfigured() {
  return Boolean(
    serverEnv.STRIPE_SECRET_KEY &&
    serverEnv.STRIPE_PRICE_ROOTS_FAMILY_MONTHLY &&
    serverEnv.STRIPE_PRICE_ROOTS_FAMILY_ANNUAL,
  );
}

export function stripePriceForPlan(plan: BillingPlan) {
  const price =
    plan === "monthly"
      ? serverEnv.STRIPE_PRICE_ROOTS_FAMILY_MONTHLY
      : serverEnv.STRIPE_PRICE_ROOTS_FAMILY_ANNUAL;
  if (!price) throw new StripeConfigurationError("stripe_price_not_configured");
  return price;
}

export function stripePlanForPriceId(priceId: string): BillingPlan | null {
  if (priceId === serverEnv.STRIPE_PRICE_ROOTS_FAMILY_MONTHLY) return "monthly";
  if (priceId === serverEnv.STRIPE_PRICE_ROOTS_FAMILY_ANNUAL) return "annual";
  return null;
}

function stripeEnvironment() {
  return serverEnv.STRIPE_SECRET_KEY?.startsWith("sk_live_") ? "live" : "test";
}

async function stripeRequest<T extends StripeResponse>(
  path: string,
  values: Record<string, string> = {},
  options: { method?: "GET" | "POST"; idempotencyKey?: string } = {},
) {
  if (!serverEnv.STRIPE_SECRET_KEY) {
    throw new StripeConfigurationError("stripe_not_configured");
  }
  const method = options.method ?? "POST";
  const headers: HeadersInit = {
    authorization: `Bearer ${serverEnv.STRIPE_SECRET_KEY}`,
    "content-type": "application/x-www-form-urlencoded",
  };
  if (options.idempotencyKey)
    headers["idempotency-key"] = options.idempotencyKey;
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers,
    ...(method === "POST" ? { body: new URLSearchParams(values) } : {}),
    cache: "no-store",
  });
  const payload = (await response.json()) as T & {
    error?: { message?: string };
  };
  if (!response.ok) {
    throw new StripeRequestError(
      payload.error?.message ?? "stripe_request_failed",
    );
  }
  return payload;
}

export function createStripeCustomer(
  email: string | undefined,
  familyId: string,
) {
  return stripeRequest<{ id: string }>(
    "customers",
    {
      ...(email ? { email } : {}),
      "metadata[family_id]": familyId,
    },
    { idempotencyKey: `kinavela-customer-${familyId}` },
  );
}

export function createCheckoutSession({
  customerId,
  familyId,
  profileId,
  priceId,
  plan,
}: {
  customerId: string;
  familyId: string;
  profileId: string;
  priceId: string;
  plan: BillingPlan;
}) {
  return stripeRequest<{ id: string; url: string }>("checkout/sessions", {
    mode: "subscription",
    customer: customerId,
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
    success_url: `${publicEnv.NEXT_PUBLIC_APP_URL}/en/app/settings?billing=success`,
    cancel_url: `${publicEnv.NEXT_PUBLIC_APP_URL}/en/app/settings?billing=cancelled`,
    client_reference_id: familyId,
    "metadata[family_id]": familyId,
    "metadata[profile_id]": profileId,
    "metadata[plan]": plan,
    "metadata[product_key]": "roots_family",
    "metadata[environment]": stripeEnvironment(),
    "subscription_data[metadata][family_id]": familyId,
    "subscription_data[metadata][product_key]": "roots_family",
    "subscription_data[metadata][plan]": plan,
    "subscription_data[metadata][environment]": stripeEnvironment(),
  });
}

export function createCustomerPortalSession(customerId: string) {
  return stripeRequest<{ url: string }>("billing_portal/sessions", {
    customer: customerId,
    return_url: `${publicEnv.NEXT_PUBLIC_APP_URL}/en/app/settings`,
  });
}

export function retrieveStripeSubscription(subscriptionId: string) {
  return stripeRequest<Record<string, unknown>>(
    `subscriptions/${encodeURIComponent(subscriptionId)}`,
    {},
    { method: "GET" },
  );
}

export function verifyStripeWebhookSignature(
  payload: string,
  signature: string,
) {
  const secret = serverEnv.STRIPE_WEBHOOK_SECRET;
  if (!secret)
    throw new StripeConfigurationError("stripe_webhook_not_configured");
  const parts = signature.split(",");
  const timestamp = parts.find((part) => part.startsWith("t="))?.slice(2);
  const signatures = parts
    .filter((part) => part.startsWith("v1="))
    .map((part) => part.slice(3));
  if (
    !timestamp ||
    !/^\d+$/.test(timestamp) ||
    signatures.length === 0 ||
    Math.abs(Date.now() / 1000 - Number(timestamp)) > 300
  ) {
    throw new StripeRequestError("invalid_stripe_signature");
  }
  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  if (
    !signatures.some((value) => {
      const actual = Buffer.from(value, "hex");
      return (
        actual.length === expectedBuffer.length &&
        timingSafeEqual(actual, expectedBuffer)
      );
    })
  ) {
    throw new StripeRequestError("invalid_stripe_signature");
  }
  return true;
}
