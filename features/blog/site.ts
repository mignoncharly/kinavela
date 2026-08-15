/**
 * Absolute URLs for structured data and the feed. Both must be fully qualified
 * — a relative URL in JSON-LD or RSS is silently discarded by the consumers
 * that matter, unlike the `metadataBase`-relative paths Next resolves for
 * <link> tags.
 */
export const SITE_URL = "https://www.kinavela.com";

/** The brand name is a proper noun and identical in every language. */
export const BRAND_NAME = "Kinavela";

/** Stable @id anchors already published by the homepage graph. */
export const ORGANIZATION_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;

export function absoluteUrl(path: string) {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
