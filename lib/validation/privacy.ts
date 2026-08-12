import { z } from "zod";

export const personalDataExportSchema = z
  .object({
    export_id: z.string().uuid(),
    status: z.enum(["queued", "processing", "ready", "failed", "expired"]),
    requested_at: z.string().datetime({ offset: true }),
    completed_at: z.string().datetime({ offset: true }).nullable(),
    expires_at: z.string().datetime({ offset: true }).nullable(),
  })
  .strict();

export const consentSchema = z
  .object({
    consent_type: z.enum([
      "privacy_policy",
      "terms",
      "community_guidelines",
      "product_email",
    ]),
    policy_version: z.string().min(1).max(32),
    granted_at: z.string().datetime({ offset: true }),
    revoked_at: z.string().datetime({ offset: true }).nullable(),
  })
  .strict();

export const productEmailConsentSchema = z
  .object({ product_email: z.boolean() })
  .strict();
