import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { hasLocationMetadata } from "./lib/image-location.mjs";

/**
 * Reports the surface tells of machine-written prose in content/blog.
 *
 * This is a smoke detector, not a judge. It cannot tell whether a post
 * contains something only a human at Kinavela could know — that is what the
 * pull-request review is for. What it can do is catch the handful of habits
 * that reliably make writing read as generated, so the reviewer spends their
 * attention on the substance instead.
 *
 * Every rule here is tuned against false positives on purpose. A linter that
 * cries wolf gets muted, and a muted linter protects nothing.
 *
 *   node scripts/check-blog-voice.mjs            report, always exit 0
 *   node scripts/check-blog-voice.mjs --strict   exit 1 if anything is found
 */

// Resolved lazily and defensively: under a test runner `import.meta.url` is
// not necessarily a file: URL, and this module is imported there for its pure
// analysis functions, which need no filesystem at all.
function projectRoot() {
  try {
    return resolve(fileURLToPath(new URL("..", import.meta.url)));
  } catch {
    return process.cwd();
  }
}

/**
 * Phrases that mark generated prose, per language. The English list does not
 * help a German post, so each language carries its own — an English-only ban
 * list on a German-first blog would check nothing at all.
 */
export const BANNED_PHRASES = {
  shared: [/\bgame[- ]changer\b/i, /\btapestry\b/i, /\bholistic\b/i],
  de: [
    /\bin der heutigen schnelllebigen\b/i,
    /\bin der heutigen zeit\b/i,
    /\bes ist wichtig zu (beachten|betonen|erwähnen)\b/i,
    /\bes sei darauf hingewiesen\b/i,
    /\bzusammenfassend lässt sich sagen\b/i,
    /\bin diesem (artikel|beitrag) (werden wir|erfahren sie)\b/i,
    /\btauchen wir ein\b/i,
    /\bspielt eine (wichtige|entscheidende|zentrale) rolle\b/i,
    /\bnahtlos\b/i,
    /\beine vielfalt an\b/i,
    /\bnicht zuletzt\b/i,
  ],
  fr: [
    /\bdans le monde d['’]aujourd['’]hui\b/i,
    /\bà l['’]ère (du|de la) numérique\b/i,
    /\bil est important de (noter|souligner)\b/i,
    /\bil convient de souligner\b/i,
    /\ben conclusion\b/i,
    /\bplongeons dans\b/i,
    /\bjoue un rôle (crucial|essentiel|clé)\b/i,
    /\bune riche (tapisserie|palette)\b/i,
    /\btransparente et fluide\b/i,
  ],
  en: [
    /\bdelve\b/i,
    /\bleverage\b/i,
    /\bseamless(ly)?\b/i,
    /\brobust\b/i,
    /\bnavigat(e|ing) the complexit(y|ies)\b/i,
    /\bin today['’]s (fast[- ]paced|ever[- ]changing|digital)\b/i,
    /\bit['’]s not just [^.!?]{1,60}?,? it['’]s\b/i,
    /\blet['’]s dive in\b/i,
    /\bat the end of the day\b/i,
    /\bunlock (the|your|its)\b/i,
    /\bempower(s|ing)? (families|people|users|communities)\b/i,
    /\ba testament to\b/i,
    /\bit is important to note\b/i,
    /\bin conclusion\b/i,
  ],
};

/** Headings that announce a summary instead of ending the piece. */
const CONCLUSION_HEADINGS = {
  de: /^(fazit|zusammenfassung|schlusswort)\b/i,
  fr: /^(conclusion|en résumé|pour conclure)\b/i,
  en: /^(conclusion|in summary|final thoughts|takeaways?)\b/i,
};

const MONTHS = {
  de: /\b(januar|februar|märz|april|mai|juni|juli|august|september|oktober|november|dezember)\b/i,
  fr: /\b(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\b/i,
  en: /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i,
};

/**
 * Privacy patterns. These are not style — they are the site's own promises,
 * checked mechanically because a reviewer reading for voice will not reliably
 * notice a house number in the third paragraph.
 */

/** A street name followed by a house number, in any of the three languages. */
const STREET_ADDRESS = [
  /\b[A-ZÄÖÜ][\wäöüß-]{2,}(straße|strasse|weg|gasse|allee|platz|ring|damm)\s+\d+/,
  /\b\d{1,4},?\s+(rue|avenue|boulevard|impasse|chemin)\s+[A-ZÉÈ]/i,
  /\b\d{1,4}\s+[A-Z][a-z]+\s+(Street|Road|Avenue|Lane)\b/,
];

/** Naming a child's school or nursery locates the child. */
const CHILD_INSTITUTION =
  /\b(kita|kindergarten|kindertagesstätte|grundschule|gesamtschule|gymnasium|realschule|crèche|maternelle|école|nursery|primary school)\s+[A-ZÄÖÜÉÈ][\wäöüßéè-]{2,}/i;

/**
 * Blocking rules describe harm — a house number, a child's school, an
 * unconsented quote, coordinates in a photo. Advisory rules describe style.
 * Only the first kind should be able to fail a build: a release stopped by an
 * em-dash count teaches people to pass --no-verify, which then also skips the
 * rules that mattered.
 */
export const BLOCKING_RULES = new Set([
  "street-address",
  "child-institution",
  "missing-consent",
  "image-location-metadata",
  "missing-image",
]);

export function severityOf(rule) {
  return BLOCKING_RULES.has(rule) ? "blocking" : "advisory";
}

const MIN_PARAGRAPHS_FOR_UNIFORMITY = 5;
/** Below this spread, every paragraph is suspiciously the same length. */
const UNIFORMITY_THRESHOLD = 0.22;
const MIN_LISTS_FOR_MONOTONY = 2;
const EM_DASHES_PER_100_WORDS = 1.5;

/** Splits frontmatter off and blanks fenced code, keeping line numbers intact. */
export function bodyOf(source) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  let start = 0;
  if (lines[0]?.trim() === "---") {
    const closing = lines.findIndex(
      (line, index) => index > 0 && line.trim() === "---",
    );
    if (closing !== -1) start = closing + 1;
  }

  const body = lines.map((line, index) => (index < start ? "" : line));
  let inFence = false;
  return body.map((line) => {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      return "";
    }
    return inFence ? "" : line;
  });
}

/** The raw frontmatter block, for the privacy rules that need to read it. */
export function frontmatterOf(source) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  if (lines[0]?.trim() !== "---") return "";
  const closing = lines.findIndex(
    (line, index) => index > 0 && line.trim() === "---",
  );
  return closing === -1 ? "" : lines.slice(1, closing).join("\n");
}

function paragraphsOf(lines) {
  const paragraphs = [];
  let current = [];
  for (const line of lines) {
    const trimmed = line.trim();
    const isProse =
      trimmed !== "" &&
      !trimmed.startsWith("#") &&
      !trimmed.startsWith(">") &&
      !/^([-*+]|\d+\.)\s/.test(trimmed) &&
      !/^\|/.test(trimmed);
    if (isProse) current.push(trimmed);
    else if (current.length > 0) {
      paragraphs.push(current.join(" "));
      current = [];
    }
  }
  if (current.length > 0) paragraphs.push(current.join(" "));
  return paragraphs;
}

function listsOf(lines) {
  const lists = [];
  let count = 0;
  for (const line of lines) {
    if (/^\s*([-*+]|\d+\.)\s/.test(line)) count += 1;
    else if (count > 0) {
      lists.push(count);
      count = 0;
    }
  }
  if (count > 0) lists.push(count);
  return lists;
}

function headingsOf(lines) {
  return lines.flatMap((line, index) => {
    const match = /^#{1,6}\s+(.*)$/.exec(line.trim());
    return match ? [{ line: index + 1, text: (match[1] ?? "").trim() }] : [];
  });
}

function wordCount(text) {
  return text.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}

function coefficientOfVariation(values) {
  if (values.length < 2) return Infinity;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (mean === 0) return Infinity;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / mean;
}

/**
 * @param {string} source raw markdown, frontmatter included
 * @param {{ locale: string, label: string }} context
 */
export function analysePost(
  source,
  { locale = "de", label = "<inline>" } = {},
) {
  const lines = bodyOf(source);
  const text = lines.join("\n");
  const findings = [];
  const add = (rule, message, line = 0, excerpt = "") =>
    findings.push({
      label,
      line,
      rule,
      message,
      excerpt,
      severity: severityOf(rule),
    });

  const patterns = [
    ...(BANNED_PHRASES.shared ?? []),
    ...(BANNED_PHRASES[locale] ?? []),
  ];
  for (const [index, line] of lines.entries()) {
    for (const pattern of patterns) {
      const match = pattern.exec(line);
      if (match) {
        add(
          "banned-phrase",
          `reads as generated: "${match[0]}"`,
          index + 1,
          line.trim().slice(0, 90),
        );
      }
    }
  }

  for (const heading of headingsOf(lines)) {
    if (CONCLUSION_HEADINGS[locale]?.test(heading.text)) {
      add(
        "conclusion-heading",
        `"${heading.text}" summarises instead of ending — stop when you are done`,
        heading.line,
      );
    }
    if (heading.text.endsWith("?")) {
      add(
        "question-heading",
        `rhetorical question as a heading: "${heading.text}"`,
        heading.line,
      );
    }
  }

  const lists = listsOf(lines);
  if (
    lists.length >= MIN_LISTS_FOR_MONOTONY &&
    lists.every((length) => length === 3)
  ) {
    add(
      "list-monotony",
      `every one of the ${lists.length} lists has exactly three items`,
    );
  }

  const paragraphs = paragraphsOf(lines);
  if (paragraphs.length >= MIN_PARAGRAPHS_FOR_UNIFORMITY) {
    const spread = coefficientOfVariation(paragraphs.map(wordCount));
    if (spread < UNIFORMITY_THRESHOLD) {
      add(
        "uniform-paragraphs",
        `all ${paragraphs.length} paragraphs are near-identical in length (spread ${spread.toFixed(2)})`,
      );
    }
  }

  const words = wordCount(text);
  const emDashes = (text.match(/—/g) ?? []).length;
  if (words > 0 && (emDashes * 100) / words > EM_DASHES_PER_100_WORDS) {
    add(
      "em-dash-density",
      `${emDashes} em dashes in ${words} words is heavier than a person writes`,
    );
  }

  // A proxy for "contains something concrete". It cannot see whether the
  // detail is true or lived — only that the post names nothing at all.
  const hasYear = /\b(19|20)\d{2}\b/.test(text);
  const hasNumber = /\d/.test(text);
  const hasMonth = MONTHS[locale]?.test(text) ?? false;
  if (words > 120 && !hasYear && !hasNumber && !hasMonth) {
    add(
      "no-specifics",
      "no date, number or month anywhere — nothing here could only have been written by someone who was there",
    );
  }

  // --- privacy rules ---

  for (const [index, line] of lines.entries()) {
    for (const pattern of STREET_ADDRESS) {
      const match = pattern.exec(line);
      if (match) {
        add(
          "street-address",
          `looks like a street-level address: "${match[0].trim()}" — the site promises precise locations are never published`,
          index + 1,
          line.trim().slice(0, 90),
        );
      }
    }
    const institution = CHILD_INSTITUTION.exec(line);
    if (institution) {
      add(
        "child-institution",
        `names a school or nursery: "${institution[0].trim()}" — that locates a child`,
        index + 1,
        line.trim().slice(0, 90),
      );
    }
  }

  // A block quote is almost always somebody's actual words. If nobody has
  // recorded consent for them, that needs deciding before the post ships, not
  // after someone recognises themselves.
  const frontmatter = frontmatterOf(source);
  const quoteLine = lines.findIndex((line) => /^\s*>\s+\S/.test(line));
  if (quoteLine !== -1 && !/^\s*consentRef:/m.test(frontmatter)) {
    add(
      "missing-consent",
      "quotes someone but carries no consentRef — see docs/blog-consent-and-withdrawal.md",
      quoteLine + 1,
    );
  }

  return findings;
}

/** Author bios ship with a placeholder flag until their subject rewrites them. */
export function placeholderAuthorFindings(authorsSource, label) {
  if (!/placeholderBio:\s*true/.test(authorsSource)) return [];
  const line =
    authorsSource
      .split("\n")
      .findIndex((text) => /placeholderBio:\s*true/.test(text)) + 1;
  return [
    {
      label,
      line,
      rule: "placeholder-bio",
      severity: severityOf("placeholder-bio"),
      message:
        "an author bio is still the shipped placeholder — a byline in someone else's words defeats the point",
      excerpt: "",
    },
  ];
}

/** Site-relative image paths a post points at: hero plus inline markdown. */
export function referencedImages(source) {
  const paths = new Set();
  const hero = /^\s*heroImage:\s*["']?(\/[^\s"']+)/m.exec(
    frontmatterOf(source),
  );
  if (hero?.[1]) paths.add(hero[1]);
  for (const match of source.matchAll(/!\[[^\]]*\]\((\/[^)\s]+)/g)) {
    if (match[1]) paths.add(match[1]);
  }
  return [...paths];
}

/**
 * Every image a post points at must exist and must not carry coordinates.
 * A photo committed straight from a phone is the likeliest way to publish a
 * precise location by accident, and it is invisible in review.
 */
function imageFindings(source, label, publicRoot) {
  return referencedImages(source).flatMap((path) => {
    const filePath = join(publicRoot, path.replace(/^\//, ""));
    let bytes;
    try {
      bytes = readFileSync(filePath);
    } catch {
      return [
        {
          label,
          line: 0,
          rule: "missing-image",
          severity: severityOf("missing-image"),
          message: `references ${path}, which is not in public/`,
          excerpt: "",
        },
      ];
    }
    return hasLocationMetadata(bytes)
      ? [
          {
            label,
            line: 0,
            rule: "image-location-metadata",
            severity: severityOf("image-location-metadata"),
            message: `${path} still carries GPS metadata — strip EXIF before committing`,
            excerpt: "",
          },
        ]
      : [];
  });
}

function markdownFilesIn(directory) {
  let entries;
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries.flatMap((entry) => {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) return markdownFilesIn(fullPath);
    return entry.name.endsWith(".md") && entry.name !== "README.md"
      ? [fullPath]
      : [];
  });
}

export function reviewBlogContent(root = null) {
  const rootPath = projectRoot();
  const contentRoot = root ?? join(rootPath, "content", "blog");

  const publicRoot = join(rootPath, "public");

  const findings = markdownFilesIn(contentRoot).flatMap((file) => {
    const locale = /([a-z]{2})\.md$/.exec(file)?.[1] ?? "de";
    const source = readFileSync(file, "utf8");
    const label = relative(rootPath, file);
    return [
      ...analysePost(source, { locale, label }),
      ...imageFindings(source, label, publicRoot),
    ];
  });

  const authorsPath = join(contentRoot, "authors.ts");
  try {
    findings.push(
      ...placeholderAuthorFindings(
        readFileSync(authorsPath, "utf8"),
        relative(rootPath, authorsPath),
      ),
    );
  } catch {
    // No authors file yet is not this script's problem.
  }

  return findings;
}

function main() {
  const strict = process.argv.includes("--strict");
  const findings = reviewBlogContent();

  if (findings.length === 0) {
    console.log("Blog voice check passed.");
    return;
  }

  const blocking = findings.filter(
    (finding) => finding.severity === "blocking",
  );

  console.log(
    `Blog check: ${findings.length} finding(s), ${blocking.length} blocking. See docs/blog-editorial-standard.md.`,
  );
  for (const finding of findings) {
    const where = finding.line
      ? `${finding.label}:${finding.line}`
      : finding.label;
    const mark = finding.severity === "blocking" ? "BLOCKING" : "advisory";
    console.log(`- [${mark}] ${where} [${finding.rule}] ${finding.message}`);
    if (finding.excerpt) console.log(`    ${finding.excerpt}`);
  }

  // Privacy findings always fail. Style findings fail only when asked: a
  // release stopped by an em-dash count teaches people to bypass the hook,
  // which then also skips the rules that protect somebody.
  if (blocking.length > 0) {
    console.error(
      `${blocking.length} blocking finding(s) — these describe published harm, not style.`,
    );
    process.exitCode = 1;
  } else if (strict) {
    console.error("Advisory findings are release-blocking in strict mode.");
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main();
