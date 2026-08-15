import { z } from "zod";

import { locales } from "@/lib/i18n/config";

/**
 * Frontmatter is parsed by hand rather than with a YAML library. The format is
 * a fixed, flat set of keys, and every parse failure is raised as an error that
 * names the file and line — so an author who writes something the parser does
 * not understand gets a failed build, never a silently mis-read post. That
 * loudness is what makes the small parser safe to prefer over a dependency.
 */

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const KEY_PATTERN = /^([A-Za-z][A-Za-z0-9_]*):[ \t]*(.*)$/;
const SLUG_LIKE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const isoDate = z
  .string()
  .regex(DATE_PATTERN, "expected a YYYY-MM-DD date")
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return (
      !Number.isNaN(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value
    );
  }, "not a real calendar date");

export const blogFrontmatterSchema = z
  .object({
    title: z.string().min(3).max(140),
    excerpt: z.string().min(20).max(300),
    author: z.string().regex(SLUG_LIKE, "author must be an authors.ts key"),
    published: isoDate,
    updated: isoDate.optional(),
    tags: z.array(z.string().regex(SLUG_LIKE)).max(6).default([]),
    heroImage: z
      .string()
      .startsWith("/", "hero images are served from /public")
      .optional(),
    heroAlt: z.string().min(3).max(200).optional(),
    originalLocale: z.enum(locales),
    translator: z.string().min(2).max(80).optional(),
    // Slug of a /community/<slug> page this post belongs with. Checked against
    // the real page list at load time, so a typo fails the build instead of
    // rendering a link to a 404.
    community: z.string().regex(SLUG_LIKE).optional(),
    // Opaque pointer into the consent store. The record itself lives outside
    // git so that names and signatures never enter the repository.
    consentRef: z
      .string()
      .regex(/^c_[a-z0-9]{6,40}$/)
      .optional(),
  })
  .strict()
  .refine((value) => !value.heroImage || Boolean(value.heroAlt), {
    message: "heroAlt is required whenever heroImage is set",
    path: ["heroAlt"],
  });

export type ParsedDocument = {
  data: Record<string, unknown>;
  body: string;
};

function stripQuotes(value: string) {
  const first = value.at(0);
  const last = value.at(-1);
  if (value.length >= 2 && (first === '"' || first === "'") && last === first) {
    return value.slice(1, -1);
  }
  return value;
}

function parseScalar(value: string) {
  if (value.startsWith("[") && value.endsWith("]")) {
    const inner = value.slice(1, -1).trim();
    if (inner === "") return [];
    return inner.split(",").map((item) => stripQuotes(item.trim()));
  }
  return stripQuotes(value);
}

/**
 * Splits a `---` fenced frontmatter block from the markdown body.
 * `label` is only used to make errors point at the offending file.
 */
export function splitFrontmatter(
  source: string,
  label: string,
): ParsedDocument {
  const normalised = source.replace(/\r\n/g, "\n");
  const lines = normalised.split("\n");

  if (lines[0]?.trim() !== "---") {
    throw new Error(`${label}: must start with a --- frontmatter fence`);
  }

  const closing = lines.findIndex(
    (line, index) => index > 0 && line.trim() === "---",
  );
  if (closing === -1) {
    throw new Error(`${label}: frontmatter fence is never closed`);
  }

  const data: Record<string, unknown> = {};
  for (let index = 1; index < closing; index += 1) {
    const line = lines[index] ?? "";
    if (line.trim() === "" || line.trimStart().startsWith("#")) continue;

    const match = KEY_PATTERN.exec(line);
    if (!match) {
      throw new Error(
        `${label}:${index + 1}: expected "key: value", got ${JSON.stringify(line)}`,
      );
    }

    const key = match[1] ?? "";
    const rawValue = (match[2] ?? "").trim();
    if (key in data) {
      throw new Error(`${label}:${index + 1}: duplicate key "${key}"`);
    }
    if (rawValue === "") {
      throw new Error(`${label}:${index + 1}: "${key}" has no value`);
    }
    data[key] = parseScalar(rawValue);
  }

  return {
    data,
    body: lines
      .slice(closing + 1)
      .join("\n")
      .trim(),
  };
}

/** Splits and validates in one step, raising a readable error on failure. */
export function parseFrontmatter(source: string, label: string) {
  const { data, body } = splitFrontmatter(source, label);
  const result = blogFrontmatterSchema.safeParse(data);
  if (!result.success) {
    const detail = result.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    throw new Error(`${label}: invalid frontmatter — ${detail}`);
  }
  return { frontmatter: result.data, body };
}
