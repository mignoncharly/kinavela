import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const files = execFileSync(
  "git",
  ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
  {
    encoding: "utf8",
  },
)
  .split("\0")
  .filter(Boolean);

const rules = [
  ["private key material", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["live Stripe secret", /\b(?:sk|rk)_live_[A-Za-z0-9]{16,}\b/],
  ["long Stripe webhook secret", /\bwhsec_[A-Za-z0-9]{24,}\b/],
  ["OpenAI API key", /\bsk-(?:proj|svc)-[A-Za-z0-9_-]{20,}\b/],
  [
    "Supabase service JWT",
    /\beyJ[A-Za-z0-9_-]{80,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/,
  ],
];

const findings = [];
for (const file of files) {
  if (file === ".github/workflows/ci.yml" || !existsSync(file)) continue;
  const source = readFileSync(file, "utf8");
  for (const [name, pattern] of rules) {
    if (pattern.test(source)) findings.push({ file, name });
  }
}

if (findings.length > 0) {
  for (const finding of findings)
    console.error(`Secret-like ${finding.name} found in ${finding.file}`);
  process.exit(1);
}

console.log(`Secret scan passed for ${files.length} tracked files.`);
