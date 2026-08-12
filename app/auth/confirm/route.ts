import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { publicEnv } from "@/lib/env.public";
import { isLocale } from "@/lib/i18n/config";
import { createClient } from "@/lib/supabase/server";

const allowedTypes = new Set<EmailOtpType>(["signup", "magiclink", "recovery"]);

// Base absolute redirects on the public app URL rather than request.url:
// behind the nginx reverse proxy, Next resolves request.url to the internal
// host (localhost:3020), which would otherwise leak into the Location header.
const appUrl = publicEnv.NEXT_PUBLIC_APP_URL;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const rawType = url.searchParams.get("type") as EmailOtpType | null;
  const rawLocale = url.searchParams.get("locale") ?? "de";
  const locale = isLocale(rawLocale) ? rawLocale : "de";
  if (!tokenHash || !rawType || !allowedTypes.has(rawType)) {
    return NextResponse.redirect(
      new URL(`/${locale}/auth/login?error=invalid_link`, appUrl),
    );
  }
  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: rawType,
  });
  if (error || !data.user) {
    return NextResponse.redirect(
      new URL(`/${locale}/auth/login?error=expired_link`, appUrl),
    );
  }
  if (rawType === "recovery") {
    return NextResponse.redirect(
      new URL(`/${locale}/auth/update-password`, appUrl),
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
      appUrl,
    ),
  );
}
