import type { Breadcrumb, Event } from "@sentry/nextjs";

const FILTERED = "[Filtered]";
const SENSITIVE_KEYS = new Set([
  "authorization",
  "cookie",
  "cookies",
  "password",
  "passwd",
  "secret",
  "token",
  "access_token",
  "refresh_token",
  "id_token",
  "apikey",
  "api_key",
  "body",
  "request_body",
  "formdata",
  "form_data",
  "transcript",
  "audio",
  "message_body",
  "child",
  "children",
  "nickname",
  "family_name",
  "display_name",
  "address",
  "latitude",
  "longitude",
]);

const TOKEN_PATH_PREFIXES = new Set(["invite", "record", "confirm"]);

export function redactSentryText(value: string) {
  return value
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email]")
    .replace(
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi,
      "[id]",
    )
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+=*\b/gi, "Bearer [token]")
    .replace(
      /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
      "[token]",
    )
    .replace(
      /([?&](?:token|code|secret|key|email|redirect_to)=)[^&#\s]+/gi,
      "$1[filtered]",
    );
}

function sanitizePath(pathname: string) {
  const segments = pathname.split("/");
  let hideNext = false;

  return segments
    .map((segment) => {
      if (!segment) return segment;
      if (hideNext) {
        hideNext = false;
        return "[filtered]";
      }

      const normalized = segment.toLowerCase();
      if (TOKEN_PATH_PREFIXES.has(normalized)) {
        hideNext = true;
        return segment;
      }

      if (
        /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(segment) ||
        /^[A-Za-z0-9_-]{40,}$/.test(segment)
      ) {
        return "[id]";
      }

      return segment;
    })
    .join("/");
}

export function sanitizeSentryUrl(value: string) {
  try {
    const url = new URL(value, "https://www.kinavela.com");
    const path = sanitizePath(url.pathname);
    return value.startsWith("http") ? url.origin + path : path;
  } catch {
    return redactSentryText(value.split("?")[0] ?? "");
  }
}

function scrubUnknown(
  value: unknown,
  key = "",
  depth = 0,
  seen = new WeakSet<object>(),
): unknown {
  if (SENSITIVE_KEYS.has(key.toLowerCase())) return FILTERED;
  if (typeof value === "string") {
    const normalizedKey = key.toLowerCase();
    if (
      ["url", "from", "to", "path", "pathname"].includes(normalizedKey) ||
      normalizedKey.endsWith("_url") ||
      normalizedKey.endsWith("_path")
    ) {
      return sanitizeSentryUrl(value);
    }
    return redactSentryText(value);
  }
  if (value === null || typeof value !== "object") return value;
  if (depth >= 6) return FILTERED;
  if (seen.has(value)) return FILTERED;

  seen.add(value);
  if (Array.isArray(value)) {
    return value
      .slice(0, 50)
      .map((item) => scrubUnknown(item, key, depth + 1, seen));
  }

  return Object.fromEntries(
    Object.entries(value).map(([childKey, childValue]) => [
      childKey,
      scrubUnknown(childValue, childKey, depth + 1, seen),
    ]),
  );
}

export function scrubSentryBreadcrumb(
  breadcrumb: Breadcrumb,
): Breadcrumb | null {
  if (
    breadcrumb.category === "console" ||
    breadcrumb.category?.startsWith("ui.")
  )
    return null;

  const sanitized = scrubUnknown(breadcrumb) as Breadcrumb;
  if (typeof sanitized.message === "string") {
    sanitized.message = redactSentryText(sanitized.message);
  }
  if (typeof sanitized.data?.url === "string") {
    sanitized.data.url = sanitizeSentryUrl(sanitized.data.url);
  }
  return sanitized;
}

export function scrubSentryEvent<T extends Event>(event: T): T {
  const sanitized = scrubUnknown(event) as T;

  delete sanitized.user;

  if (sanitized.request) {
    const { method, url } = sanitized.request;
    sanitized.request = {
      ...(method ? { method } : {}),
      ...(url ? { url: sanitizeSentryUrl(url) } : {}),
    };
  }

  if (sanitized.breadcrumbs) {
    sanitized.breadcrumbs = sanitized.breadcrumbs
      .map(scrubSentryBreadcrumb)
      .filter((item): item is Breadcrumb => item !== null);
  }

  return sanitized;
}
