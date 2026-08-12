import "server-only";

import { z } from "zod";

const serverEnvSchema = z
  .object({
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
    DATABASE_URL: z.string().startsWith("postgresql://"),
    SMTP_HOST: z.literal("smtp.zoho.eu"),
    SMTP_PORT: z.coerce.number().int().positive().default(465),
    SMTP_SECURE: z
      .enum(["true", "false"])
      .default("true")
      .transform((value) => value === "true"),
    SMTP_USER: z.string().email(),
    SMTP_PASSWORD: z.string().min(8),
    EMAIL_FROM: z.string().min(3),
    EMAIL_REPLY_TO: z.string().email(),
    WEB_PUSH_VAPID_PRIVATE_KEY: z.string().min(40).optional().or(z.literal("")),
    WEB_PUSH_VAPID_SUBJECT: z
      .string()
      .url()
      .or(z.string().startsWith("mailto:"))
      .optional()
      .or(z.literal("")),
    GEOCODING_BASE_URL: z
      .string()
      .url()
      .default("https://nominatim.openstreetmap.org"),
    EVENT_REMINDER_CRON_SECRET: z.string().min(32),
    PRIVACY_RETENTION_CRON_SECRET: z
      .string()
      .min(32)
      .optional()
      .or(z.literal("")),
    SENTRY_DSN: z.string().url().optional().or(z.literal("")),
    STRIPE_SECRET_KEY: z
      .string()
      .startsWith("sk_")
      .optional()
      .or(z.literal("")),
    STRIPE_WEBHOOK_SECRET: z
      .string()
      .startsWith("whsec_")
      .optional()
      .or(z.literal("")),
    STRIPE_PRICE_ROOTS_FAMILY_MONTHLY: z
      .string()
      .startsWith("price_")
      .optional()
      .or(z.literal("")),
    STRIPE_PRICE_ROOTS_FAMILY_ANNUAL: z
      .string()
      .startsWith("price_")
      .optional()
      .or(z.literal("")),
    OPENAI_TRANSCRIPTION_MODEL: z
      .enum(["gpt-4o-transcribe", "gpt-4o-mini-transcribe"])
      .default("gpt-4o-transcribe"),
    AI_TRANSCRIPTION_MAX_BYTES: z.coerce
      .number()
      .int()
      .min(1)
      .max(25000000)
      .default(25000000),
    AI_PROVIDER: z.enum(["disabled", "openai"]).default("disabled"),
    OPENAI_API_KEY: z.string().min(20).optional().or(z.literal("")),
    OPENAI_MODEL: z
      .enum(["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"])
      .default("gpt-5.6-terra"),
    AI_REASONING_EFFORT: z
      .enum(["none", "low", "medium", "high", "xhigh", "max"])
      .default("medium"),
    AI_MAX_OUTPUT_TOKENS: z.coerce
      .number()
      .int()
      .min(256)
      .max(8192)
      .default(2048),
    AI_PROCESSING_APPROVED: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    AI_WORKER_CRON_SECRET: z.string().min(32).optional().or(z.literal("")),
  })
  .superRefine((value, context) => {
    if (value.AI_PROVIDER === "openai" && !value.OPENAI_API_KEY) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["OPENAI_API_KEY"],
        message: "OPENAI_API_KEY is required when AI_PROVIDER=openai",
      });
    }
    if (value.AI_PROVIDER === "openai" && !value.AI_WORKER_CRON_SECRET) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["AI_WORKER_CRON_SECRET"],
        message: "AI_WORKER_CRON_SECRET is required when AI_PROVIDER=openai",
      });
    }
  });

export const serverEnv = serverEnvSchema.parse({
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  DATABASE_URL: process.env.DATABASE_URL,
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT,
  SMTP_SECURE: process.env.SMTP_SECURE,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASSWORD: process.env.SMTP_PASSWORD,
  EMAIL_FROM: process.env.EMAIL_FROM,
  EMAIL_REPLY_TO: process.env.EMAIL_REPLY_TO,
  WEB_PUSH_VAPID_PRIVATE_KEY: process.env.WEB_PUSH_VAPID_PRIVATE_KEY,
  WEB_PUSH_VAPID_SUBJECT: process.env.WEB_PUSH_VAPID_SUBJECT,
  GEOCODING_BASE_URL: process.env.GEOCODING_BASE_URL,
  EVENT_REMINDER_CRON_SECRET: process.env.EVENT_REMINDER_CRON_SECRET,
  PRIVACY_RETENTION_CRON_SECRET: process.env.PRIVACY_RETENTION_CRON_SECRET,
  SENTRY_DSN: process.env.SENTRY_DSN,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  STRIPE_PRICE_ROOTS_FAMILY_MONTHLY:
    process.env.STRIPE_PRICE_ROOTS_FAMILY_MONTHLY,
  STRIPE_PRICE_ROOTS_FAMILY_ANNUAL:
    process.env.STRIPE_PRICE_ROOTS_FAMILY_ANNUAL,
  OPENAI_TRANSCRIPTION_MODEL: process.env.OPENAI_TRANSCRIPTION_MODEL,
  AI_TRANSCRIPTION_MAX_BYTES: process.env.AI_TRANSCRIPTION_MAX_BYTES,
  AI_PROVIDER: process.env.AI_PROVIDER,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_MODEL: process.env.OPENAI_MODEL,
  AI_REASONING_EFFORT: process.env.AI_REASONING_EFFORT,
  AI_MAX_OUTPUT_TOKENS: process.env.AI_MAX_OUTPUT_TOKENS,
  AI_PROCESSING_APPROVED: process.env.AI_PROCESSING_APPROVED,
  AI_WORKER_CRON_SECRET: process.env.AI_WORKER_CRON_SECRET,
});
