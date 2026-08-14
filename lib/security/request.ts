import { createHash } from "node:crypto";

import { publicEnv } from "@/lib/env.public";

function configuredAppOrigins() {
  const configured = new URL(publicEnv.NEXT_PUBLIC_APP_URL);
  const origins = new Set([configured.origin]);
  const alternate = new URL(configured);

  if (configured.hostname.startsWith("www.")) {
    alternate.hostname = configured.hostname.slice(4);
    origins.add(alternate.origin);
  } else {
    alternate.hostname = `www.${configured.hostname}`;
    origins.add(alternate.origin);
  }

  return origins;
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  let normalizedOrigin: string | null = null;
  try {
    normalizedOrigin = origin ? new URL(origin).origin : null;
  } catch {
    normalizedOrigin = null;
  }
  if (!normalizedOrigin || !configuredAppOrigins().has(normalizedOrigin)) {
    throw new Error("invalid_origin");
  }
}

export function requestFingerprint(request: Request, email: string) {
  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  const address = forwarded || request.headers.get("x-real-ip") || "unknown";
  return createHash("sha256")
    .update(`${email.trim().toLowerCase()}|${address}`)
    .digest("hex");
}

export function clientAddressFingerprint(request: Request) {
  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  const address = forwarded || request.headers.get("x-real-ip") || "unknown";
  return createHash("sha256").update(address).digest("hex");
}

export function safeNextPath(value: unknown, fallback: string) {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//")
  ) {
    return fallback;
  }
  return value;
}
