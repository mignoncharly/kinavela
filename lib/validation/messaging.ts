import { z } from "zod";

export const reportReasons = [
  "harassment",
  "spam",
  "fraud",
  "unsafe_behavior",
  "inappropriate_child_content",
  "discrimination",
  "impersonation",
  "other",
] as const;

export const conversationCreateSchema = z.object({
  family_id: z.string().uuid(),
});

export const messageSendSchema = z.object({
  conversation_id: z.string().uuid(),
  body: z.string().trim().min(1).max(2000),
  reply_to: z.string().uuid().nullable().optional(),
});

export const conversationReadSchema = z.object({
  conversation_id: z.string().uuid(),
});

export const conversationMuteSchema = conversationReadSchema.extend({
  muted: z.boolean(),
});

export const reportSchema = z.object({
  target_type: z.enum(["family", "message"]),
  target_id: z.string().uuid(),
  reason: z.enum(reportReasons),
  details: z.string().trim().max(1000).optional().default(""),
});
