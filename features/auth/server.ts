import "server-only";

import type { GenerateLinkType } from "@supabase/supabase-js";

import { publicEnv } from "@/lib/env.public";
import type { Locale } from "@/lib/i18n/config";
import { requestFingerprint } from "@/lib/security/request";
import { createAdminClient } from "@/lib/supabase/admin";

export async function enforceAuthRateLimit(
  request: Request,
  email: string,
  action: "signup" | "magic_link" | "recovery" | "login",
) {
  const { data, error } = await createAdminClient().rpc(
    "consume_auth_rate_limit",
    {
      p_identifier_hash: requestFingerprint(request, email),
      p_action: action,
      p_max_attempts: action === "login" ? 10 : 5,
      p_window_seconds: 900,
    },
  );
  if (error) throw error;
  if (!data) throw new Error("rate_limited");
}

export async function authEmailExists(email: string) {
  const { data, error } = await createAdminClient().rpc(
    "auth_email_registered",
    { p_email: email },
  );
  if (error) throw error;
  return Boolean(data);
}

export function confirmationUrl(
  tokenHash: string,
  type: GenerateLinkType,
  locale: Locale,
) {
  const url = new URL("/auth/confirm", publicEnv.NEXT_PUBLIC_APP_URL);
  url.searchParams.set("token_hash", tokenHash);
  url.searchParams.set("type", type);
  url.searchParams.set("locale", locale);
  return url.toString();
}
