import { z } from "zod";

import { reportReasons } from "@/lib/validation/messaging";

export const villageTypes = [
  "local",
  "culture",
  "language",
  "activity",
  "temporary",
] as const;
export const villageRoles = [
  "owner",
  "organizer",
  "moderator",
  "member",
] as const;

export const villageIdSchema = z
  .object({ village_id: z.string().uuid() })
  .strict();

export const villageCreateSchema = z
  .object({
    name: z.string().trim().min(3).max(100),
    description: z.string().trim().min(10).max(1000),
    village_type: z.enum(villageTypes).default("local"),
    country_focus_id: z.string().uuid().nullable().optional(),
    radius_km: z.number().int().min(5).max(100).default(40),
    visibility: z.enum(["listed", "private"]).default("listed"),
    member_limit: z.number().int().min(3).max(100).default(30),
  })
  .strict();

export const villageMembershipActionSchema = z.discriminatedUnion("action", [
  villageIdSchema.extend({ action: z.literal("request") }),
  villageIdSchema.extend({
    action: z.literal("invite"),
    family_id: z.string().uuid(),
  }),
  villageIdSchema.extend({
    action: z.literal("respond_invitation"),
    accept: z.boolean(),
  }),
  villageIdSchema.extend({
    action: z.literal("respond_request"),
    family_id: z.string().uuid(),
    accept: z.boolean(),
  }),
  villageIdSchema.extend({
    action: z.literal("set_role"),
    family_id: z.string().uuid(),
    role: z.enum(villageRoles),
  }),
  villageIdSchema.extend({ action: z.literal("leave") }),
  villageIdSchema.extend({
    action: z.literal("remove"),
    family_id: z.string().uuid(),
  }),
]);

export const villageMessageSchema = villageIdSchema.extend({
  body: z.string().trim().min(1).max(2000),
  reply_to: z.string().uuid().nullable().optional(),
});

export const villageMuteSchema = villageIdSchema.extend({ muted: z.boolean() });

export const villageReportSchema = villageIdSchema.extend({
  message_id: z.string().uuid().nullable().optional(),
  reason: z.enum(reportReasons),
  details: z.string().trim().max(1000).optional().default(""),
});

export const villageReportResolutionSchema = z
  .object({
    report_id: z.string().uuid(),
    resolution: z.enum([
      "dismiss",
      "delete_message",
      "remove_member",
      "escalate",
      "cancel_event",
      "restrict_event",
      "delete_support_content",
    ]),
  })
  .strict();
