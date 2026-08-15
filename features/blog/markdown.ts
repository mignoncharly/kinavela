import { Marked, type RendererObject } from "marked";

import { SITE_URL } from "./site";

/**
 * Post bodies are written by the team and reviewed in git, so they are trusted
 * input. They are nonetheless rendered through a renderer that cannot emit raw
 * HTML and cannot emit a URL outside a small scheme allowlist: guest pieces and
 * pasted interview transcripts are exactly where a stray tag or a javascript:
 * href arrives, and a review is a weaker guarantee than a parser that has no
 * way to produce the dangerous output in the first place.
 *
 * This replaces a DOM-based sanitiser. Nothing here parses attacker HTML — it
 * simply never constructs any.
 */

const SAFE_PROTOCOLS = new Set(["https:", "http:", "mailto:"]);

/**
 * The page template owns the only <h1>, so a post's top-level heading must
 * render as <h2>. Rather than a fixed offset — which silently produced <h3>
 * with no <h2> above it whenever an author reached for `##` instead of `#` —
 * the shallowest heading in a document is normalised to level 2 and the rest
 * shift with it. Relative structure is preserved; the outline never skips.
 */
let headingOffset = 1;

function headingOffsetFor(body: string) {
  const depths = [...body.matchAll(/^(#{1,6})\s+\S/gm)].map(
    (match) => (match[1] ?? "").length,
  );
  const shallowest = Math.min(...depths);
  return depths.length === 0 ? 1 : 2 - shallowest;
}

const WORDS_PER_MINUTE = 200;

function escapeAttribute(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Returns a safe href, or null when the URL must not be emitted at all. */
export function safeUrl(href: string): string | null {
  const trimmed = href.trim();
  if (trimmed === "") return null;
  // Protocol-relative URLs inherit the page scheme and hide their host, so they
  // are treated as external and rejected rather than resolved.
  if (trimmed.startsWith("//")) return null;
  if (trimmed.startsWith("/") || trimmed.startsWith("#")) return trimmed;
  try {
    const url = new URL(trimmed);
    return SAFE_PROTOCOLS.has(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function isExternal(href: string) {
  return /^https?:/i.test(href) && !href.startsWith(`${SITE_URL}/`);
}

// A plain object, deliberately: marked merges the *own enumerable* properties
// of whatever is handed to `renderer`, so a Renderer subclass instance — whose
// methods live on the prototype — would be merged as nothing at all and every
// override below would silently do nothing.
const renderer: RendererObject = {
  /** Raw HTML — block or inline — is dropped. Its text content survives. */
  html() {
    return "";
  },

  heading({ tokens, depth }) {
    const level = Math.min(Math.max(depth + headingOffset, 2), 6);
    return `<h${level}>${this.parser.parseInline(tokens)}</h${level}>\n`;
  },

  link({ href, title, tokens }) {
    const text = this.parser.parseInline(tokens);
    const safe = safeUrl(href);
    // An unsafe link degrades to its own text rather than disappearing, so a
    // bad URL never silently deletes a sentence.
    if (!safe) return text;
    const titleAttribute = title ? ` title="${escapeAttribute(title)}"` : "";
    const relAttribute = isExternal(safe) ? ' rel="noopener noreferrer"' : "";
    return `<a href="${escapeAttribute(safe)}"${titleAttribute}${relAttribute}>${text}</a>`;
  },

  image({ href, title, text }) {
    const safe = safeUrl(href);
    if (!safe) return escapeAttribute(text);
    const titleAttribute = title ? ` title="${escapeAttribute(title)}"` : "";
    return `<img src="${escapeAttribute(safe)}" alt="${escapeAttribute(text)}"${titleAttribute} loading="lazy" />`;
  },
};

const parser = new Marked({ gfm: true, breaks: false, renderer });

export function renderMarkdown(body: string): string {
  // Set immediately before a synchronous parse. Module-level state is safe
  // here only because parse() never yields; keep it that way.
  headingOffset = headingOffsetFor(body);
  const html = parser.parse(body, { async: false });
  return typeof html === "string" ? html : "";
}

export function readingMinutes(body: string): number {
  const words = body
    .replace(/```[\s\S]*?```/g, " ")
    .split(/\s+/)
    .filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}
