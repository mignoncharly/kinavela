import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { publicEnv } from "@/lib/env.public";

export async function proxy(request: NextRequest) {
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const q = String.fromCharCode(39);
  const supabaseOrigin = new URL(publicEnv.NEXT_PUBLIC_SUPABASE_URL).origin;
  const supabaseSocketOrigin = supabaseOrigin
    .replace(/^https:/, "wss:")
    .replace(/^http:/, "ws:");
  const csp = [
    "default-src " + q + "self" + q,
    "script-src " +
      q +
      "self" +
      q +
      " " +
      q +
      "nonce-" +
      nonce +
      q +
      " " +
      q +
      "strict-dynamic" +
      q,
    "style-src " + q + "self" + q + " " + q + "nonce-" + nonce + q,
    "img-src " + q + "self" + q + " data: blob: " + supabaseOrigin,
    "media-src " + q + "self" + q + " blob: " + supabaseOrigin,
    "font-src " + q + "self" + q,
    "connect-src " +
      q +
      "self" +
      q +
      " " +
      supabaseOrigin +
      " " +
      supabaseSocketOrigin,
    "worker-src " + q + "self" + q + " blob:",
    "object-src " + q + "none" + q,
    "base-uri " + q + "self" + q,
    "form-action " + q + "self" + q,
    "frame-ancestors " + q + "none" + q,
  ].join("; ");
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  let response = NextResponse.next({ request: { headers: requestHeaders } });
  const supabase = createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookies) {
          cookies.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          requestHeaders.set("cookie", request.cookies.toString());
          response = NextResponse.next({
            request: { headers: requestHeaders },
          });
          cookies.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const apiPath = request.nextUrl.pathname.startsWith("/api/");
  const protectedPath = new RegExp(
    "^/(de|fr|en)/(app(?:/.*)?|onboarding|admin(?:/.*)?)$",
  ).test(request.nextUrl.pathname);
  if (protectedPath && !user) {
    const locale = request.nextUrl.pathname.split("/")[1] || "de";
    // Base the redirect on the public app URL: behind the reverse proxy
    // request.nextUrl resolves to the internal host (localhost:3020).
    const url = new URL(`/${locale}/auth/login`, publicEnv.NEXT_PUBLIC_APP_URL);
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  if ((protectedPath || apiPath) && user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("status")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (profile?.status === "suspended") {
      if (apiPath) {
        const blocked = NextResponse.json(
          { error: "account_suspended" },
          { status: 403 },
        );
        blocked.headers.set("Content-Security-Policy", csp);
        return blocked;
      }
      const locale = request.nextUrl.pathname.split("/")[1] || "de";
      const blocked = NextResponse.redirect(
        new URL(`/${locale}/suspended`, publicEnv.NEXT_PUBLIC_APP_URL),
      );
      blocked.headers.set("Content-Security-Policy", csp);
      return blocked;
    }
  }
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
