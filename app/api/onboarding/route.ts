import { NextResponse } from "next/server";

import { assertSameOrigin } from "@/lib/security/request";
import { createClient } from "@/lib/supabase/server";
import { onboardingSchema } from "@/lib/validation/onboarding";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json(
        { ok: false, error: "not_authenticated" },
        { status: 401 },
      );
    if (!user.email_confirmed_at)
      return NextResponse.json(
        { ok: false, error: "email_not_verified" },
        { status: 403 },
      );
    const payload = onboardingSchema.parse(await request.json());
    if (payload.preferences.min_child_age > payload.preferences.max_child_age) {
      return NextResponse.json(
        { ok: false, error: "invalid_age_range" },
        { status: 400 },
      );
    }
    const { data, error } = await supabase.rpc(
      "complete_family_onboarding_with_location",
      { p_payload: payload },
    );
    if (error) throw error;
    return NextResponse.json({ ok: true, familyId: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    if (message === "invalid_origin")
      return NextResponse.json(
        { ok: false, error: "invalid_request" },
        { status: 403 },
      );
    if (message.includes("family_already_exists"))
      return NextResponse.json(
        { ok: false, error: "already_completed" },
        { status: 409 },
      );
    console.error("Onboarding failed", { message });
    return NextResponse.json(
      { ok: false, error: "invalid_input" },
      { status: 400 },
    );
  }
}
