import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const locales = ["de", "fr", "en"];
const approvedStaticLiterals = new Set([
  "K",
  "KINAVELA",
  "KINAVELA OPS",
  "ROOTS",
  "VILLAGE",
  "ROOTS PASSPORT",
]);

function leaves(value, path = "") {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => leaves(item, `${path}[${index}]`));
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) =>
      leaves(item, path ? `${path}.${key}` : key),
    );
  }
  return [{ path, value }];
}

export function dictionaryIssues(dictionaries) {
  const base = leaves(dictionaries.de);
  const basePaths = new Set(base.map(({ path }) => path));
  const issues = [];

  for (const locale of locales) {
    const translated = leaves(dictionaries[locale]);
    const translatedPaths = new Set(translated.map(({ path }) => path));

    for (const path of basePaths) {
      if (!translatedPaths.has(path)) issues.push(`${locale}: missing ${path}`);
    }
    for (const path of translatedPaths) {
      if (!basePaths.has(path)) issues.push(`${locale}: unexpected ${path}`);
    }
    for (const { path, value } of translated) {
      if (typeof value === "string" && value.trim() === "")
        issues.push(`${locale}: empty ${path}`);
    }
  }

  return issues;
}

export function findStaticUserFacingLiterals(source, file = "<inline>") {
  const findings = [];
  const lines = source.split(/\r?\n/);
  const attributePattern =
    /\b(aria-label|aria-description|alt|placeholder|title)\s*=\s*(["'])(.*?)\2/g;
  const textPattern = /(?<![=])>([^<>{}\n]*[A-Za-zÀ-ÿ][^<>{}\n]*)</g;

  for (const [index, line] of lines.entries()) {
    for (const match of line.matchAll(attributePattern)) {
      findings.push({
        file,
        line: index + 1,
        kind: match[1],
        value: match[3].trim(),
      });
    }
    for (const match of line.matchAll(textPattern)) {
      const value = match[1].trim();
      if (value && !approvedStaticLiterals.has(value))
        findings.push({ file, line: index + 1, kind: "text", value });
    }
  }

  return findings;
}

function filesIn(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) return filesIn(fullPath);
    return entry.name.endsWith(".tsx") ? [fullPath] : [];
  });
}

export function sourceLiteralFindings(root = projectRoot) {
  const sourceFiles = ["app", "components"].flatMap((directory) =>
    filesIn(join(root, directory)),
  );
  return sourceFiles.flatMap((file) =>
    findStaticUserFacingLiterals(
      readFileSync(file, "utf8"),
      relative(root, file),
    ),
  );
}

function readLandingDictionaries() {
  return Object.fromEntries(
    locales.map((locale) => [
      locale,
      JSON.parse(
        readFileSync(join(projectRoot, "messages", `${locale}.json`), "utf8"),
      ),
    ]),
  );
}

function runSelfTest() {
  const findings = findStaticUserFacingLiterals(
    '<button aria-label="Save changes">Save</button>',
  );
  if (
    findings.length !== 2 ||
    !findings.some((finding) => finding.kind === "aria-label") ||
    !findings.some((finding) => finding.kind === "text")
  ) {
    throw new Error("Static user-facing literal detection is not working.");
  }
  console.log("Localization static-literal self-test passed.");
}

function main() {
  if (process.argv.includes("--self-test")) {
    runSelfTest();
    return;
  }
  const dictionariesOnly = process.argv.includes("--dictionaries-only");
  const strict = process.argv.includes("--strict");
  const issues = dictionaryIssues(readLandingDictionaries());

  if (issues.length > 0) {
    console.error("Localization dictionary coverage failed:");
    for (const issue of issues) console.error(`- ${issue}`);
    process.exitCode = 1;
  } else {
    console.log("Localization dictionary coverage passed.");
  }

  if (dictionariesOnly) return;

  const findings = sourceLiteralFindings();
  if (findings.length === 0) {
    console.log("No static user-facing literals found.");
    return;
  }

  console.log(
    `Static user-facing literal report: ${findings.length} finding(s). See docs/localization-inventory.md for planned removal.`,
  );
  for (const finding of findings)
    console.log(
      `- ${finding.file}:${finding.line} [${finding.kind}] ${finding.value}`,
    );

  if (strict) {
    console.error(
      "Static user-facing literals are release-blocking in strict localization mode.",
    );
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main();
