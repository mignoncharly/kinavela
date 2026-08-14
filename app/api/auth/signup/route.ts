import { NextResponse } from "next/server";

import { ZodError } from "zod";
import { sendAuthEmail } from "@/features/auth/email";
import {
  authEmailExists,
  confirmationUrl,
  enforceAuthRateLimit,
} from "@/features/auth/server";
import type { Locale } from "@/lib/i18n/config";
import { assertSameOrigin } from "@/lib/security/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { signupSchema } from "@/lib/validation/auth";

const accepted = { ok: true, message: "confirmation_sent" };

type AdminClient = ReturnType<typeof createAdminClient>;

function isEmailExists(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const { code, message } = error as { code?: string; message?: string };
  // supabase-js exposes `code` on newer releases only, so fall back to the
  // GoTrue message rather than silently missing the case after an upgrade.
  return (
    code === "email_exists" ||
    (message ?? "").toLowerCase().includes("already been registered")
  );
}

/**
 * Mails someone who tried to sign up with an address that already has an
 * account. A magic link covers both shapes this can take: if they never
 * confirmed the original signup, following it confirms them; if they did,
 * it simply signs them in. Failures are swallowed on purpose — the caller
 * must return the same response it would for a brand-new address.
 */
async function sendExistingAccountEmail(
  admin: AdminClient,
  email: string,
  locale: Locale,
) {
  try {
    const { data, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (error || !data.properties.hashed_token) return;
    await sendAuthEmail(
      email,
      locale,
      data.user?.email_confirmed_at ? "existing" : "signup",
      confirmationUrl(data.properties.hashed_token, "magiclink", locale),
    );
  } catch (error) {
    console.error("Existing-account notice failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = signupSchema.parse(await request.json());
    if (input.website) return NextResponse.json(accepted, { status: 202 });
    await enforceAuthRateLimit(request, input.email, "signup");

    const admin = createAdminClient();

    // Settle this before touching the account. generateLink only rejects an
    // existing address once it is confirmed; for an unconfirmed one it happily
    // regenerates the link, and the request then walked on into the consent
    // insert, tripped consents_active_unique, and hit a rollback that deleted
    // an account this request never created. Submitting the form twice was
    // enough to destroy someone's pending signup.
    //
    // Returning `accepted` here keeps the response free of enumeration signal,
    // and the owner still hears about it by email.
    if (await authEmailExists(input.email)) {
      await sendExistingAccountEmail(admin, input.email, input.locale);
      return NextResponse.json(accepted, { status: 202 });
    }

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
    // Same case, reached by a registration that landed between the check above
    // and this call.
    if (isEmailExists(error)) {
      await sendExistingAccountEmail(admin, input.email, input.locale);
      return NextResponse.json(accepted, { status: 202 });
    }
    if (error || !data.user || !data.properties.hashed_token) {
      return NextResponse.json(accepted, { status: 202 });
    }

    // Only ever roll back the account this request brought into existence.
    const createdUserId = data.user.id;

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id")
      .eq("auth_user_id", data.user.id)
      .single();
    if (profileError || !profile) {
      await admin.auth.admin.deleteUser(createdUserId);
      throw profileError ?? new Error("profile_creation_failed");
    }
    const { error: consentError } = await admin.from("consents").insert([
      {
        profile_id: profile.id,
        consent_type: "privacy_policy",
        policy_version: "1.0",
      },
      {
        profile_id: profile.id,
        consent_type: "terms",
        policy_version: "1.0",
      },
    ]);
    if (consentError) {
      await admin.auth.admin.deleteUser(createdUserId);
      throw consentError;
    }

    try {
      await sendAuthEmail(
        input.email,
        input.locale,
        "signup",
        confirmationUrl(
          data.properties.hashed_token,
          "signup",
          input.locale,
          input.invite_token,
        ),
      );
    } catch (error) {
      await admin.auth.admin.deleteUser(createdUserId);
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
