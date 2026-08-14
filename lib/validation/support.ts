import { z } from "zod";

export const supportContentTypes = [
  "question",
  "help_request",
  "recommendation_request",
  "resource",
  "announcement",
  "offer_of_help",
] as const;

export const supportCategories = [
  "kita",
  "school",
  "german_language",
  "administration",
  "immigration_integration",
  "healthcare_navigation",
  "local_family_services",
  "transport",
  "childcare_coordination",
  "local_recommendations",
  "other_practical_support",
] as const;

export const supportReportReasons = [
  "privacy_exposure",
  "unsafe_advice",
  "harassment",
  "discrimination",
  "fraud",
  "child_safety_concern",
  "outdated_or_misleading",
  "other",
] as const;

export const supportModerationReasons = [
  "unsafe",
  "privacy",
  "outdated",
  "duplicate",
  "other",
] as const;

const villageId = z.string().uuid();
const postId = z.string().uuid();
const replyId = z.string().uuid();

export const supportFilterSchema = z
  .object({
    q: z.string().trim().min(2).max(80).optional(),
    category: z.enum(supportCategories).optional(),
    content_type: z.enum(supportContentTypes).optional(),
    status: z.enum(["open", "resolved", "all"]).default("open"),
  })
  .strict();

export const supportActionSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("create"),
      village_id: villageId,
      content_type: z.enum(supportContentTypes),
      category: z.enum(supportCategories),
      title: z.string().trim().min(5).max(120),
      body: z.string().trim().min(10).max(2000),
      privacy_confirmed: z.literal(true),
    })
    .strict(),
  z
    .object({
      action: z.literal("reply"),
      post_id: postId,
      body: z.string().trim().min(2).max(1500),
      privacy_confirmed: z.literal(true),
    })
    .strict(),
  z
    .object({
      action: z.literal("close"),
      post_id: postId,
    })
    .strict(),
  z
    .object({
      action: z.literal("report"),
      post_id: postId,
      reply_id: replyId.nullable().optional(),
      reason: z.enum(supportReportReasons),
      details: z.string().trim().max(1000).default(""),
    })
    .strict(),
  z
    .object({
      action: z.literal("moderate"),
      post_id: postId.nullable().optional(),
      reply_id: replyId.nullable().optional(),
      reason: z.enum(supportModerationReasons),
    })
    .strict()
    .superRefine((value, context) => {
      if ((value.post_id == null) === (value.reply_id == null))
        context.addIssue({
          code: "custom",
          message: "exactly_one_support_target_required",
        });
    }),
]);
