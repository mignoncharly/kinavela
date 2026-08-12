import { z } from "zod";

const isoDate = z.string().datetime({ offset: true });

export const adminReportSchema = z
  .object({
    report_id: z.string().uuid(),
    target_type: z.enum(["family", "message", "village"]),
    target_family_id: z.string().uuid().nullable(),
    target_message_id: z.string().uuid().nullable(),
    target_village_id: z.string().uuid().nullable(),
    reason: z.string().min(2).max(80),
    details: z.string().max(1000).nullable(),
    status: z.enum(["open", "reviewing", "resolved", "dismissed"]),
    reporter_profile_id: z.string().uuid(),
    created_at: isoDate,
    updated_at: isoDate,
  })
  .strict();

export const adminUserSchema = z
  .object({
    profile_id: z.string().uuid(),
    display_name: z.string(),
    status: z.enum(["active", "suspended", "deleted"]),
    verification_level: z.string(),
    onboarding_completed: z.boolean(),
    family_count: z.number().int().nonnegative(),
    created_at: isoDate,
  })
  .strict();

export const adminFamilySchema = z
  .object({
    family_id: z.string().uuid(),
    name: z.string(),
    city: z.string(),
    country_of_residence: z.string(),
    visibility: z.enum(["private", "discoverable"]),
    member_count: z.number().int().nonnegative(),
    created_at: isoDate,
  })
  .strict();

export const adminVillageSchema = z
  .object({
    village_id: z.string().uuid(),
    name: z.string(),
    village_type: z.string(),
    city: z.string(),
    status: z.enum(["active", "archived"]),
    member_count: z.number().int().nonnegative(),
    created_at: isoDate,
  })
  .strict();

export const adminEventSchema = z
  .object({
    event_id: z.string().uuid(),
    village_id: z.string().uuid(),
    title: z.string(),
    category: z.string(),
    status: z.enum(["scheduled", "cancelled", "completed"]),
    starts_at: isoDate,
    created_at: isoDate,
  })
  .strict();

export const adminAiJobSchema = z
  .object({
    job_id: z.string().uuid(),
    feature: z.string(),
    status: z.enum(["queued", "processing", "completed", "failed"]),
    moderation_status: z.enum([
      "pending_review",
      "flagged",
      "approved",
      "rejected",
    ]),
    attempts: z.number().int().nonnegative(),
    cost_micros: z.number().int().nonnegative().nullable(),
    created_at: isoDate,
    updated_at: isoDate,
  })
  .strict();

export const adminPilotMetricSchema = z
  .object({
    metric_key: z.string().min(2).max(80),
    metric_value: z.number(),
    denominator: z.number().nonnegative(),
    as_of: isoDate,
  })
  .strict();

export const adminRegionalDensitySchema = z
  .object({
    country_code: z.literal("DE"),
    city: z.string().min(2).max(120),
    waiting_count: z.number().int().nonnegative(),
    family_count: z.number().int().nonnegative(),
    threshold: z.number().int().positive(),
    rollout_status: z.enum(["waitlist", "open", "paused"]),
  })
  .strict();

export const adminAuditEventSchema = z
  .object({
    audit_id: z.string().uuid(),
    event_type: z.string(),
    entity_type: z.string().nullable(),
    entity_id: z.string().uuid().nullable(),
    actor_profile_id: z.string().uuid().nullable(),
    metadata: z.record(z.string(), z.unknown()),
    created_at: isoDate,
  })
  .strict();

export const adminFeatureFlagSchema = z
  .object({
    flag_key: z.string(),
    enabled: z.boolean(),
    rollout_percent: z.number().int().min(0).max(100),
    description: z.string(),
    updated_at: isoDate,
  })
  .strict();

export const adminActionSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("set_report_status"),
      report_id: z.string().uuid(),
      status: z.enum(["reviewing", "resolved", "dismissed"]),
    })
    .strict(),
  z
    .object({
      action: z.literal("suspend_profile"),
      profile_id: z.string().uuid(),
      reason: z.string().max(500).optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal("restore_profile"),
      profile_id: z.string().uuid(),
    })
    .strict(),
  z
    .object({
      action: z.literal("set_feature_flag"),
      flag_key: z.string().regex(/^[a-z][a-z0-9_]{2,79}$/),
      enabled: z.boolean(),
      rollout_percent: z.number().int().min(0).max(100),
      description: z.string().max(240).optional(),
    })
    .strict(),
]);

export type AdminAction = z.infer<typeof adminActionSchema>;

export function parseAdminRows<T extends z.ZodType>(schema: T, value: unknown) {
  return z.array(schema).safeParse(value);
}
