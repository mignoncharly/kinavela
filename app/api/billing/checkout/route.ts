import { NextResponse } from "next/server";

import {
  createCheckoutSession,
  createStripeCustomer,
  StripeConfigurationError,
  stripeConfigured,
  stripePriceForPlan,
} from "@/lib/billing/stripe";
import { assertSameOrigin } from "@/lib/security/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { billingCheckoutSchema } from "@/lib/validation/billing";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = billingCheckoutSchema.parse(await request.json());
    if (!stripeConfigured())
      return NextResponse.json(
        { ok: false, error: "billing_unavailable" },
        { status: 503 },
      );
    const priceId = stripePriceForPlan(input.plan);
    const supabase = await createClient();
    const { data: billingEnabled, error: billingFlagError } =
      await supabase.rpc("is_feature_enabled", {
        p_flag_key: "premium_billing",
      });
    if (billingFlagError || !billingEnabled)
      return NextResponse.json(
        { ok: false, error: "billing_unavailable" },
        { status: 503 },
      );
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false }, { status: 401 });
    const { data: profile } = await supabase
      .from("profiles")
      .select("id,status")
      .eq("auth_user_id", user.id)
      .single();
    if (!profile || profile.status !== "active")
      return NextResponse.json({ ok: false }, { status: 403 });
    const { data: membership } = await supabase
      .from("family_members")
      .select("family_id")
      .eq("profile_id", profile.id)
      .eq("status", "active")
      .in("role", ["owner"])
      .limit(1)
      .maybeSingle();
    if (!membership) return NextResponse.json({ ok: false }, { status: 403 });
    const admin = createAdminClient();
    const { data: existingSubscription } = await admin
      .from("subscriptions")
      .select("status")
      .eq("family_id", membership.family_id)
      .in("status", [
        "incomplete",
        "trialing",
        "active",
        "past_due",
        "unpaid",
        "paused",
      ])
      .limit(1)
      .maybeSingle();
    if (existingSubscription)
      return NextResponse.json(
        { ok: false, error: "subscription_already_exists" },
        { status: 409 },
      );
    let { data: customer } = await admin
      .from("billing_customers")
      .select("stripe_customer_id")
      .eq("family_id", membership.family_id)
      .maybeSingle();
    if (!customer) {
      const created = await createStripeCustomer(
        user.email,
        membership.family_id,
      );
      const { data: saved, error } = await admin
        .from("billing_customers")
        .upsert(
          { family_id: membership.family_id, stripe_customer_id: created.id },
          { onConflict: "family_id" },
        )
        .select("stripe_customer_id")
        .single();
      if (error || !saved)
        throw error ?? new Error("billing_customer_not_saved");
      customer = saved;
    }
    const session = await createCheckoutSession({
      customerId: customer.stripe_customer_id,
      familyId: membership.family_id,
      profileId: profile.id,
      priceId,
      plan: input.plan,
    });
    return NextResponse.json({ ok: true, url: session.url });
  } catch (error) {
    if (error instanceof StripeConfigurationError)
      return NextResponse.json(
        { ok: false, error: "billing_unavailable" },
        { status: 503 },
      );
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
