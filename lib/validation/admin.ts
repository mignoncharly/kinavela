import { z } from "zod";

const isoDate = z.string().datetime({ offset: true });

export const adminReportSchema = z
  .object({
    report_id: z.string().uuid(),
    target_type: z.enum([
      "family",
      "message",
      "village",
      "event",
      "support_post",
      "support_reply",
    ]),
    target_family_id: z.string().uuid().nullable(),
    target_message_id: z.string().uuid().nullable(),
    target_village_id: z.string().uuid().nullable(),
    target_event_id: z.string().uuid().nullable(),
    target_event_title: z.string().min(3).max(120).nullable(),
    target_support_post_id: z.string().uuid().nullable(),
    target_support_post_title: z.string().min(5).max(120).nullable(),
    target_support_reply_id: z.string().uuid().nullable(),
    reason: z.string().min(2).max(80),
    details: z.string().max(1000).nullable(),
    status: z.enum(["open", "reviewing", "resolved", "dismissed"]),
    severity: z.enum(["low", "medium", "high", "critical"]),
    urgent_child_safety: z.boolean(),
    assigned_to_profile_id: z.string().uuid().nullable(),
    response_due_at: isoDate,
    resolution_notes: z.string().max(1000).nullable(),
    reporter_profile_id: z.string().uuid(),
    action_count: z.number().int().nonnegative(),
    created_at: isoDate,
    updated_at: isoDate,
  })
  .strict();

export const adminReportActionSchema = z
  .object({
    action_id: z.string().uuid(),
    action_type: z.enum([
      "submitted",
      "assigned",
      "note_added",
      "severity_changed",
      "escalated",
      "event_cancelled",
      "event_restricted",
      "support_content_removed",
      "resolved",
      "dismissed",
    ]),
    previous_status: z.string().nullable(),
    new_status: z.string().nullable(),
    severity: z.enum(["low", "medium", "high", "critical"]).nullable(),
    note: z.string().max(1000).nullable(),
    created_at: isoDate,
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

export const adminProductMetricSchema = z
  .object({
    metric_key: z.string().min(2).max(80),
    metric_value: z.number(),
    denominator: z.number().nonnegative(),
    as_of: isoDate,
  })
  .strict();

export const adminRegionalOutreachSchema = z
  .object({
    country_code: z.literal("DE"),
    city: z.string().min(2).max(120),
    historical_interest_count: z.number().int().nonnegative(),
    family_count: z.number().int().nonnegative(),
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
      action: z.literal("manage_report"),
      report_id: z.string().uuid(),
      operation: z.enum([
        "assign_to_me",
        "add_note",
        "set_severity",
        "resolve",
        "dismiss",
        "cancel_event",
        "restrict_event",
        "delete_support_content",
      ]),
      severity: z.enum(["low", "medium", "high", "critical"]).optional(),
      note: z.string().trim().min(2).max(1000).optional(),
    })
    .strict()
    .superRefine((value, context) => {
      if (value.operation === "set_severity" && !value.severity)
        context.addIssue({
          code: "custom",
          path: ["severity"],
          message: "severity_required",
        });
      if (
        [
          "add_note",
          "resolve",
          "dismiss",
          "cancel_event",
          "restrict_event",
          "delete_support_content",
        ].includes(value.operation) &&
        !value.note
      )
        context.addIssue({
          code: "custom",
          path: ["note"],
          message: "note_required",
        });
    }),
  z
    .object({
      action: z.literal("review_verification"),
      request_id: z.string().uuid(),
      approve: z.boolean(),
      note: z.string().trim().min(2).max(500),
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
