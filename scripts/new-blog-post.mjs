import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Scaffolds a post file so the slowest part of this project — writing — starts
 * from a blank page rather than from remembering frontmatter keys.
 *
 *   npm run blog:new -- warum-wir-kinavela-bauen
 *   npm run blog:new -- warum-wir-kinavela-bauen --locale fr --translator "Awa Diallo"
 *
 * Drafts are dated far in the future on purpose. Phase 1 already withholds
 * future-dated posts from the build, so a half-written draft can sit in the
 * repository without appearing anywhere, and publishing is one date edit.
 */

const DRAFT_DATE = "2099-01-01";
const LOCALES = ["de", "fr", "en"];
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function projectRoot() {
  try {
    return resolve(fileURLToPath(new URL("..", import.meta.url)));
  } catch {
    return process.cwd();
  }
}

/** `warum-wir-bauen` → `Warum wir bauen`, a title to edit rather than invent. */
export function humaniseSlug(slug) {
  const words = slug.split("-").join(" ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function scaffoldPost({
  slug,
  locale = "de",
  author = "admin",
  originalLocale = locale,
  translator = null,
}) {
  if (!SLUG_PATTERN.test(slug)) {
    throw new Error(
      `"${slug}" is not a valid slug — lowercase letters, digits and single hyphens`,
    );
  }
  if (!LOCALES.includes(locale)) {
    throw new Error(`"${locale}" is not one of ${LOCALES.join(", ")}`);
  }
  if (translator && originalLocale === locale) {
    throw new Error(
      "a translator implies this file is a translation, so originalLocale must be another language",
    );
  }

  const lines = [
    "---",
    `title: ${humaniseSlug(slug)}`,
    "excerpt: Ein Satz, der sagt, worum es geht. Er wird zur Meta-Beschreibung und zur Vorschau in der Liste.",
    `author: ${author}`,
    `published: ${DRAFT_DATE}`,
    `originalLocale: ${originalLocale}`,
  ];
  if (translator) lines.push(`translator: ${translator}`);
  lines.push(
    "---",
    "",
    // No headings, no lists, no filler: an empty page is the point. Anything
    // pre-written here would be the first thing a reader sees and the last
    // thing anyone remembers to delete.
    "",
  );
  return lines.join("\n");
}

function main() {
  const args = process.argv.slice(2);
  const slug = args.find((argument) => !argument.startsWith("--"));
  if (!slug) {
    console.error("Usage: npm run blog:new -- <slug> [--locale de|fr|en]");
    console.error('                            [--translator "Name"]');
    process.exitCode = 1;
    return;
  }

  const valueOf = (flag) => {
    const index = args.indexOf(flag);
    return index === -1 ? null : (args[index + 1] ?? null);
  };
  const locale = valueOf("--locale") ?? "de";
  const translator = valueOf("--translator");
  const originalLocale = valueOf("--original") ?? (translator ? "de" : locale);

  const directory = join(projectRoot(), "content", "blog", slug);
  const file = join(directory, `${locale}.md`);
  if (existsSync(file)) {
    console.error(`Refusing to overwrite content/blog/${slug}/${locale}.md`);
    process.exitCode = 1;
    return;
  }

  let contents;
  try {
    contents = scaffoldPost({ slug, locale, originalLocale, translator });
  } catch (error) {
    // A stack trace here tells an author nothing they can act on.
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
    return;
  }

  mkdirSync(directory, { recursive: true });
  writeFileSync(file, contents, "utf8");

  console.log(`Created content/blog/${slug}/${locale}.md`);
  console.log("");
  console.log("It is dated 2099-01-01, so it stays out of the build until you");
  console.log("set a real date. Before opening a pull request:");
  console.log("");
  console.log("  npm run blog:check     voice and privacy");
  console.log("  docs/blog-editorial-standard.md");
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main();
