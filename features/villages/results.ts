import { z } from "zod";

import { villageRoles, villageTypes } from "@/lib/validation/villages";

export const myVillageSchema = z
  .object({
    village_id: z.string().uuid(),
    name: z.string().min(3).max(100),
    city: z.string().min(2).max(120),
    village_type: z.enum(villageTypes),
    member_role: z.enum(villageRoles),
    member_count: z.number().int().min(1),
    last_message_at: z.string().datetime({ offset: true }).nullable(),
    muted: z.boolean(),
  })
  .strict();

export const discoverVillageSchema = z
  .object({
    village_id: z.string().uuid(),
    name: z.string().min(3).max(100),
    description: z.string().min(10).max(1000),
    city: z.string().min(2).max(120),
    village_type: z.enum(villageTypes),
    country_focus_name: z.string().min(2).max(120).nullable(),
    member_count: z.number().int().min(1),
    member_limit: z.number().int().min(3).max(100),
  })
  .strict();

export const villageInvitationSchema = z
  .object({
    village_id: z.string().uuid(),
    village_name: z.string().min(3).max(100),
    city: z.string().min(2).max(120),
    inviter_family_name: z.string().min(2).max(100),
    invited_at: z.string().datetime({ offset: true }),
  })
  .strict();

export const villageDetailSchema = z
  .object({
    village_id: z.string().uuid(),
    name: z.string().min(3).max(100),
    description: z.string().min(10).max(1000),
    city: z.string().min(2).max(120),
    village_type: z.enum(villageTypes),
    country_focus_name: z.string().min(2).max(120).nullable(),
    radius_km: z.number().int().min(5).max(100),
    visibility: z.enum(["listed", "private"]),
    member_limit: z.number().int().min(3).max(100),
    member_count: z.number().int().min(1),
    member_role: z.enum(villageRoles),
    conversation_id: z.string().uuid(),
    muted: z.boolean(),
    can_moderate: z.boolean(),
    can_manage_roles: z.boolean(),
  })
  .strict();

export const villageMemberSchema = z
  .object({
    family_id: z.string().uuid(),
    family_name: z.string().min(2).max(100),
    city: z.string().min(2).max(120),
    role: z.enum(villageRoles),
    joined_at: z.string().datetime({ offset: true }),
    is_current_family: z.boolean(),
  })
  .strict();

export const villageRequestSchema = z
  .object({
    family_id: z.string().uuid(),
    family_name: z.string().min(2).max(100),
    city: z.string().min(2).max(120),
    requested_at: z.string().datetime({ offset: true }),
  })
  .strict();

export const villageReportResultSchema = z
  .object({
    report_id: z.string().uuid(),
    target_type: z.enum([
      "message",
      "village",
      "event",
      "support_post",
      "support_reply",
    ]),
    target_family_id: z.string().uuid().nullable(),
    target_family_name: z.string().min(2).max(100).nullable(),
    target_message_id: z.string().uuid().nullable(),
    target_event_id: z.string().uuid().nullable(),
    target_event_title: z.string().min(3).max(120).nullable(),
    target_support_post_id: z.string().uuid().nullable(),
    target_support_post_title: z.string().min(5).max(120).nullable(),
    target_support_reply_id: z.string().uuid().nullable(),
    reason: z.string(),
    details: z.string().nullable(),
    status: z.enum(["open", "reviewing"]),
    severity: z.enum(["low", "medium", "high", "critical"]),
    urgent_child_safety: z.boolean(),
    response_due_at: z.string().datetime({ offset: true }),
    created_at: z.string().datetime({ offset: true }),
  })
  .strict();

export type MyVillage = z.infer<typeof myVillageSchema>;
export type VillageDetail = z.infer<typeof villageDetailSchema>;
export type VillageMember = z.infer<typeof villageMemberSchema>;
export type VillageReportResult = z.infer<typeof villageReportResultSchema>;

export const parseMyVillages = (value: unknown) =>
  myVillageSchema.array().safeParse(value);
export const parseDiscoverVillages = (value: unknown) =>
  discoverVillageSchema.array().safeParse(value);
export const parseVillageInvitations = (value: unknown) =>
  villageInvitationSchema.array().safeParse(value);
export const parseVillageDetail = (value: unknown) =>
  villageDetailSchema.array().length(1).safeParse(value);
export const parseVillageMembers = (value: unknown) =>
  villageMemberSchema.array().safeParse(value);
export const parseVillageRequests = (value: unknown) =>
  villageRequestSchema.array().safeParse(value);
export const parseVillageReports = (value: unknown) =>
  villageReportResultSchema.array().safeParse(value);
