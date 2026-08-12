const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_APP_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DATABASE_URL",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_SECURE",
  "SMTP_USER",
  "SMTP_PASSWORD",
  "EMAIL_FROM",
  "EMAIL_REPLY_TO",
  "EVENT_REMINDER_CRON_SECRET",
];

const missing = required.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error(
    `Missing required environment variables: ${missing.join(", ")}`,
  );
  process.exit(1);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

for (const name of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_APP_URL"]) {
  try {
    new URL(process.env[name]);
  } catch {
    fail(name + " must be a valid URL");
  }
}

if (!/^postgres(?:ql)?:\/\//.test(process.env.DATABASE_URL))
  fail("DATABASE_URL must use a PostgreSQL URL");

const smtpPort = Number(process.env.SMTP_PORT);
if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535)
  fail("SMTP_PORT must be an integer between 1 and 65535");
if (!["true", "false"].includes(process.env.SMTP_SECURE))
  fail("SMTP_SECURE must be true or false");
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(process.env.SMTP_USER))
  fail("SMTP_USER must be an email address");
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(process.env.EMAIL_REPLY_TO))
  fail("EMAIL_REPLY_TO must be an email address");
if (
  process.env.NODE_ENV === "production" &&
  !process.env.NEXT_PUBLIC_APP_URL.startsWith("https://")
)
  fail("NEXT_PUBLIC_APP_URL must use HTTPS in production");

if ((process.env.EVENT_REMINDER_CRON_SECRET?.length ?? 0) < 32) {
  console.error("EVENT_REMINDER_CRON_SECRET must be at least 32 characters");
  process.exit(1);
}

if (process.env.SMTP_HOST !== "smtp.zoho.eu") {
  console.error("SMTP_HOST must use the Zoho Europe endpoint smtp.zoho.eu");
  process.exit(1);
}

const aiProvider = process.env.AI_PROVIDER || "disabled";
if (!["disabled", "openai"].includes(aiProvider))
  fail("AI_PROVIDER must be disabled or openai");
if (aiProvider === "openai") {
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.length < 20)
    fail("OPENAI_API_KEY is required when AI_PROVIDER=openai");
  if (!/^gpt-5\.6-(sol|terra|luna)$/.test(process.env.OPENAI_MODEL || ""))
    fail("OPENAI_MODEL must be a supported GPT-5.6 model");
  if (
    !["gpt-4o-transcribe", "gpt-4o-mini-transcribe"].includes(
      process.env.OPENAI_TRANSCRIPTION_MODEL || "",
    )
  )
    fail("OPENAI_TRANSCRIPTION_MODEL is invalid");
  if (!/^\d+$/.test(process.env.AI_TRANSCRIPTION_MAX_BYTES || ""))
    fail("AI_TRANSCRIPTION_MAX_BYTES must be an integer");
  const maxTranscriptionBytes = Number(process.env.AI_TRANSCRIPTION_MAX_BYTES);
  if (maxTranscriptionBytes < 1 || maxTranscriptionBytes > 25000000)
    fail("AI_TRANSCRIPTION_MAX_BYTES must be between 1 and 25000000");

  if (!/^\d+$/.test(process.env.AI_MAX_OUTPUT_TOKENS || ""))
    fail("AI_MAX_OUTPUT_TOKENS must be an integer");
  const maxOutputTokens = Number(process.env.AI_MAX_OUTPUT_TOKENS);
  if (maxOutputTokens < 256 || maxOutputTokens > 8192)
    fail("AI_MAX_OUTPUT_TOKENS must be between 256 and 8192");
  if (
    !["none", "low", "medium", "high", "xhigh", "max"].includes(
      process.env.AI_REASONING_EFFORT || "",
    )
  )
    fail("AI_REASONING_EFFORT is invalid");
  if ((process.env.AI_WORKER_CRON_SECRET?.length ?? 0) < 32)
    fail("AI_WORKER_CRON_SECRET must be at least 32 characters");
}

const stripeValues = [
  process.env.STRIPE_SECRET_KEY,
  process.env.STRIPE_WEBHOOK_SECRET,
  process.env.STRIPE_PRICE_ROOTS_FAMILY_MONTHLY,
  process.env.STRIPE_PRICE_ROOTS_FAMILY_ANNUAL,
].filter(Boolean);
if (stripeValues.length > 0) {
  if (
    !process.env.STRIPE_SECRET_KEY ||
    !process.env.STRIPE_WEBHOOK_SECRET ||
    !process.env.STRIPE_PRICE_ROOTS_FAMILY_MONTHLY ||
    !process.env.STRIPE_PRICE_ROOTS_FAMILY_ANNUAL
  )
    fail(
      "Stripe configuration requires secret, webhook secret and both Roots Family prices",
    );
  if (!/^sk_(test|live)_/.test(process.env.STRIPE_SECRET_KEY))
    fail("STRIPE_SECRET_KEY must be a Stripe test or live secret");
  if (!/^whsec_/.test(process.env.STRIPE_WEBHOOK_SECRET))
    fail("STRIPE_WEBHOOK_SECRET must be a Stripe webhook secret");
  if (
    !/^price_/.test(process.env.STRIPE_PRICE_ROOTS_FAMILY_MONTHLY) ||
    !/^price_/.test(process.env.STRIPE_PRICE_ROOTS_FAMILY_ANNUAL)
  )
    fail("Stripe Roots Family prices must be Price IDs");
}

const forbiddenPublicNames = [
  "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_DATABASE_URL",
  "NEXT_PUBLIC_SMTP_PASSWORD",
  "NEXT_PUBLIC_EVENT_REMINDER_CRON_SECRET",
  "NEXT_PUBLIC_STRIPE_SECRET_KEY",
  "NEXT_PUBLIC_STRIPE_WEBHOOK_SECRET",
];
if (forbiddenPublicNames.some((name) => process.env[name])) {
  console.error(
    "A server-only secret is configured with a NEXT_PUBLIC_ prefix",
  );
  process.exit(1);
}

console.log("Kinavela environment validation passed (values not displayed).");
