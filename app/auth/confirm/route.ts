import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { isLocale } from "@/lib/i18n/config";
import { createClient } from "@/lib/supabase/server";

const allowedTypes = new Set<EmailOtpType>(["signup", "magiclink", "recovery"]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const rawType = url.searchParams.get("type") as EmailOtpType | null;
  const rawLocale = url.searchParams.get("locale") ?? "de";
  const locale = isLocale(rawLocale) ? rawLocale : "de";
  if (!tokenHash || !rawType || !allowedTypes.has(rawType)) {
    return NextResponse.redirect(
      new URL(`/${locale}/auth/login?error=invalid_link`, url),
    );
  }
  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: rawType,
  });
  if (error || !data.user) {
    return NextResponse.redirect(
      new URL(`/${locale}/auth/login?error=expired_link`, url),
    );
  }
  if (rawType === "recovery") {
    return NextResponse.redirect(
      new URL(`/${locale}/auth/update-password`, url),
    );
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed")
    .eq("auth_user_id", data.user.id)
    .single();
  return NextResponse.redirect(
    new URL(
      profile?.onboarding_completed
        ? `/${locale}/app`
        : `/${locale}/onboarding`,
      url,
    ),
  );
}
