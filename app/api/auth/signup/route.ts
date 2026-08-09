import { NextResponse } from "next/server";

import { ZodError } from "zod";
import { sendAuthEmail } from "@/features/auth/email";
import { confirmationUrl, enforceAuthRateLimit } from "@/features/auth/server";
import { assertSameOrigin } from "@/lib/security/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { signupSchema } from "@/lib/validation/auth";

const accepted = { ok: true, message: "confirmation_sent" };

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = signupSchema.parse(await request.json());
    if (input.website) return NextResponse.json(accepted, { status: 202 });
    await enforceAuthRateLimit(request, input.email, "signup");

    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.generateLink({
      type: "signup",
      email: input.email,
      password: input.password,
      options: {
        data: {
          display_name: input.displayName,
          preferred_language: input.locale,
        },
      },
    });
    if (error || !data.user || !data.properties.hashed_token) {
      return NextResponse.json(accepted, { status: 202 });
    }

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id")
      .eq("auth_user_id", data.user.id)
      .single();
    if (profileError || !profile) {
      await admin.auth.admin.deleteUser(data.user.id);
      throw profileError ?? new Error("profile_creation_failed");
    }
    const { error: consentError } = await admin.from("consents").insert([
      {
        profile_id: profile.id,
        consent_type: "privacy_policy",
        policy_version: "2026-08-09",
      },
      {
        profile_id: profile.id,
        consent_type: "terms",
        policy_version: "2026-08-09",
      },
    ]);
    if (consentError) {
      await admin.auth.admin.deleteUser(data.user.id);
      throw consentError;
    }

    try {
      await sendAuthEmail(
        input.email,
        input.locale,
        "signup",
        confirmationUrl(data.properties.hashed_token, "signup", input.locale),
      );
    } catch (error) {
      await admin.auth.admin.deleteUser(data.user.id);
      throw error;
    }
    return NextResponse.json(accepted, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    if (message === "rate_limited") {
      return NextResponse.json(
        { ok: false, error: "rate_limited" },
        { status: 429 },
      );
    }
    if (message === "invalid_origin") {
      return NextResponse.json(
        { ok: false, error: "invalid_request" },
        { status: 403 },
      );
    }
    if (error instanceof ZodError) {
      return NextResponse.json(
        { ok: false, error: "invalid_input" },
        { status: 400 },
      );
    }
    console.error("Signup failed", { message });
    return NextResponse.json(
      { ok: false, error: "service_unavailable" },
      { status: 503 },
    );
  }
}
