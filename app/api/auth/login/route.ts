import { NextResponse } from "next/server";

import { enforceAuthRateLimit } from "@/features/auth/server";
import { assertSameOrigin } from "@/lib/security/request";
import { createClient } from "@/lib/supabase/server";
import { loginSchema } from "@/lib/validation/auth";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = loginSchema.parse(await request.json());
    await enforceAuthRateLimit(request, input.email, "login");
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    });
    if (error || !data.user) {
      return NextResponse.json(
        { ok: false, error: "invalid_credentials" },
        { status: 401 },
      );
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("auth_user_id", data.user.id)
      .single();
    return NextResponse.json({
      ok: true,
      redirect: input.invite_token
        ? profile?.onboarding_completed
          ? `/${input.locale}/invite/${input.invite_token}`
          : `/${input.locale}/onboarding?invite=${input.invite_token}`
        : profile?.onboarding_completed
          ? `/${input.locale}/app`
          : `/${input.locale}/onboarding`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    const status =
      message === "rate_limited"
        ? 429
        : message === "invalid_origin"
          ? 403
          : 400;
    return NextResponse.json(
      { ok: false, error: status === 429 ? "rate_limited" : "invalid_request" },
      { status },
    );
  }
}
