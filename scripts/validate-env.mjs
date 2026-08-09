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
];

const missing = required.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error(
    `Missing required environment variables: ${missing.join(", ")}`,
  );
  process.exit(1);
}

if (process.env.SMTP_HOST !== "smtp.zoho.eu") {
  console.error("SMTP_HOST must use the Zoho Europe endpoint smtp.zoho.eu");
  process.exit(1);
}

const forbiddenPublicNames = [
  "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_DATABASE_URL",
  "NEXT_PUBLIC_SMTP_PASSWORD",
];
if (forbiddenPublicNames.some((name) => process.env[name])) {
  console.error(
    "A server-only secret is configured with a NEXT_PUBLIC_ prefix",
  );
  process.exit(1);
}

console.log("Kinavela environment validation passed (values not displayed).");
