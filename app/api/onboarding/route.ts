import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { errorMessage } from "@/lib/api/error-message";
import { assertSameOrigin } from "@/lib/security/request";
import { createClient } from "@/lib/supabase/server";
import { onboardingSchema } from "@/lib/validation/onboarding";

function onboardingError(message: string) {
  if (message.includes("invalid_location")) {
    return NextResponse.json(
      { ok: false, error: "invalid_location" },
      { status: 400 },
    );
  }
  if (message.includes("germany_location_required")) {
    return NextResponse.json(
      { ok: false, error: "germany_location_required" },
      { status: 400 },
    );
  }
  if (message.includes("family_already_exists")) {
    return NextResponse.json(
      { ok: false, error: "already_completed" },
      { status: 409 },
    );
  }
  return null;
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "not_authenticated" },
        { status: 401 },
      );
    }
    if (!user.email_confirmed_at) {
      return NextResponse.json(
        { ok: false, error: "email_not_verified" },
        { status: 403 },
      );
    }

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
    const { error: draftError } = await supabase.rpc(
      "delete_my_onboarding_draft",
    );
    if (draftError) console.error("Onboarding draft cleanup failed");
    return NextResponse.json({ ok: true, familyId: data });
  } catch (error) {
    const message = errorMessage(error);
    if (message === "invalid_origin") {
      return NextResponse.json(
        { ok: false, error: "validation_failed" },
        { status: 403 },
      );
    }
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return NextResponse.json(
        { ok: false, error: "validation_failed" },
        { status: 400 },
      );
    }
    const knownError = onboardingError(message);
    if (knownError) return knownError;

    console.error("Onboarding failed", { message });
    return NextResponse.json(
      { ok: false, error: "validation_failed" },
      { status: 400 },
    );
  }
}
