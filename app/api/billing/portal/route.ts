import { NextResponse } from "next/server";

import {
  createCustomerPortalSession,
  StripeConfigurationError,
} from "@/lib/billing/stripe";
import { assertSameOrigin } from "@/lib/security/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false }, { status: 401 });
    const { data: profile } = await supabase
      .from("profiles")
      .select("id,status")
      .eq("auth_user_id", user.id)
      .single();
    const { data: membership } = profile
      ? await supabase
          .from("family_members")
          .select("family_id")
          .eq("profile_id", profile.id)
          .eq("status", "active")
          .in("role", ["owner"])
          .limit(1)
          .maybeSingle()
      : { data: null };
    if (!profile || profile.status !== "active" || !membership)
      return NextResponse.json({ ok: false }, { status: 403 });
    const { data: customer } = await createAdminClient()
      .from("billing_customers")
      .select("stripe_customer_id")
      .eq("family_id", membership.family_id)
      .maybeSingle();
    if (!customer)
      return NextResponse.json(
        { ok: false, error: "billing_customer_missing" },
        { status: 404 },
      );
    const session = await createCustomerPortalSession(
      customer.stripe_customer_id,
    );
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
