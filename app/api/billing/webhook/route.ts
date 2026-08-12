import { NextResponse } from "next/server";

import {
  retrieveStripeSubscription,
  stripePlanForPriceId,
  verifyStripeWebhookSignature,
} from "@/lib/billing/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPPORTED_EVENTS = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
]);

type StripeEvent = {
  id?: unknown;
  type?: unknown;
  created?: unknown;
  data?: { object?: Record<string, unknown> };
};

function asString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asTimestamp(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? new Date(value * 1000).toISOString()
    : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function metadataOf(object: Record<string, unknown>) {
  return asRecord(object.metadata);
}

function subscriptionItemPriceId(object: Record<string, unknown>) {
  const items = asRecord(object.items);
  const data = Array.isArray(items.data) ? items.data : [];
  const first = asRecord(data[0]);
  return asString(asRecord(first.price).id);
}

function minimizedEvent(event: StripeEvent) {
  const object = event.data?.object ?? {};
  const metadata = metadataOf(object);
  return {
    id: asString(event.id),
    type: asString(event.type),
    created: typeof event.created === "number" ? event.created : null,
    data: {
      object: {
        id: asString(object.id),
        customer: asString(object.customer),
        subscription: asString(object.subscription),
        status: asString(object.status),
        price_id: subscriptionItemPriceId(object),
        product_key: asString(metadata.product_key),
        plan: asString(metadata.plan),
        current_period_start:
          typeof object.current_period_start === "number"
            ? object.current_period_start
            : null,
        current_period_end:
          typeof object.current_period_end === "number"
            ? object.current_period_end
            : null,
        cancel_at_period_end: object.cancel_at_period_end === true,
        canceled_at:
          typeof object.canceled_at === "number" ? object.canceled_at : null,
        ended_at: typeof object.ended_at === "number" ? object.ended_at : null,
      },
    },
  };
}

async function familyForCustomer(
  admin: ReturnType<typeof createAdminClient>,
  customerId: string,
) {
  const { data, error } = await admin
    .from("billing_customers")
    .select("family_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  if (error) throw error;
  return data?.family_id ?? null;
}

async function syncSubscription(
  admin: ReturnType<typeof createAdminClient>,
  object: Record<string, unknown>,
  eventType: string,
) {
  const customerId = asString(object.customer);
  const subscriptionId = asString(object.id);
  if (!customerId || !subscriptionId) return false;

  const metadata = metadataOf(object);
  const familyId =
    asString(metadata.family_id) ??
    (await familyForCustomer(admin, customerId));
  if (!familyId) throw new Error("billing_family_not_found");

  const priceId = subscriptionItemPriceId(object);
  if (!priceId) throw new Error("billing_price_not_found");
  const plan = stripePlanForPriceId(priceId);
  if (!plan) throw new Error("billing_price_not_configured");

  const productKey = asString(metadata.product_key) ?? "roots_family";
  if (productKey !== "roots_family")
    throw new Error("billing_product_not_allowed");

  const status =
    asString(object.status) ??
    (eventType === "customer.subscription.deleted" ? "canceled" : null);
  if (
    !status ||
    ![
      "incomplete",
      "incomplete_expired",
      "trialing",
      "active",
      "past_due",
      "canceled",
      "unpaid",
      "paused",
    ].includes(status)
  ) {
    throw new Error("billing_status_not_allowed");
  }

  const { error } = await admin.rpc("sync_billing_subscription", {
    p_family_id: familyId,
    p_stripe_customer_id: customerId,
    p_stripe_subscription_id: subscriptionId,
    p_product_key: productKey,
    p_price_id: priceId,
    p_plan: plan,
    p_status: status,
    p_current_period_start: asTimestamp(object.current_period_start),
    p_current_period_end: asTimestamp(object.current_period_end),
    p_cancel_at_period_end: object.cancel_at_period_end === true,
    p_canceled_at: asTimestamp(object.canceled_at ?? object.ended_at),
  });
  if (error) throw error;
  return true;
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  let eventId: string | null = null;
  let eventType: string | null = null;
  let eventRecorded = false;

  try {
    verifyStripeWebhookSignature(
      rawBody,
      request.headers.get("stripe-signature") ?? "",
    );

    const event = JSON.parse(rawBody) as StripeEvent;
    eventId = asString(event.id);
    eventType = asString(event.type);
    if (!eventId || !eventType || !event.data?.object) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: recorded, error: recordError } = await admin.rpc(
      "record_subscription_event",
      {
        p_stripe_event_id: eventId,
        p_event_type: eventType,
        p_payload: minimizedEvent(event),
      },
    );
    if (recordError) throw recordError;
    if (recorded === false) {
      return NextResponse.json({ received: true, duplicate: true });
    }
    eventRecorded = true;

    if (!SUPPORTED_EVENTS.has(eventType)) {
      await admin.rpc("complete_subscription_event", {
        p_stripe_event_id: eventId,
      });
      return NextResponse.json({ received: true, ignored: true });
    }

    const object = event.data.object;
    if (eventType === "checkout.session.completed") {
      const customerId = asString(object.customer);
      const metadata = metadataOf(object);
      const familyId =
        asString(metadata.family_id) ?? asString(object.client_reference_id);
      if (!customerId || !familyId)
        throw new Error("billing_checkout_metadata_missing");

      const { error } = await admin
        .from("billing_customers")
        .upsert(
          { family_id: familyId, stripe_customer_id: customerId },
          { onConflict: "family_id" },
        );
      if (error) throw error;

      const subscriptionId = asString(object.subscription);
      if (subscriptionId) {
        const subscription = await retrieveStripeSubscription(subscriptionId);
        await syncSubscription(admin, subscription, eventType);
      }
    } else if (eventType.startsWith("customer.subscription.")) {
      await syncSubscription(admin, object, eventType);
    } else {
      const subscriptionId = asString(object.subscription);
      if (subscriptionId) {
        const subscription = await retrieveStripeSubscription(subscriptionId);
        await syncSubscription(admin, subscription, eventType);
      }
    }

    const { error: completeError } = await admin.rpc(
      "complete_subscription_event",
      { p_stripe_event_id: eventId },
    );
    if (completeError) throw completeError;
    return NextResponse.json({ received: true });
  } catch (error) {
    if (eventRecorded && eventId) {
      try {
        await createAdminClient().rpc("fail_subscription_event", {
          p_stripe_event_id: eventId,
          p_error:
            error instanceof Error
              ? error.message
              : "webhook_processing_failed",
        });
      } catch {
        // Keep the original webhook failure response; Stripe will retry.
      }
    }
    console.error("stripe_webhook_processing_failed", {
      event_id: eventId,
      event_type: eventType,
      error: error instanceof Error ? error.message : "unknown_error",
    });
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
