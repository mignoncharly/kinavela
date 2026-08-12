import { createHash } from "node:crypto";

import { publicEnv } from "@/lib/env.public";

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(publicEnv.NEXT_PUBLIC_APP_URL).origin) {
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
