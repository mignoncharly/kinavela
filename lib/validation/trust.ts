import { z } from "zod";

export const trustStatusSchema = z
  .object({
    email_verified: z.boolean(),
    phone_verified: z.boolean(),
    community_verified: z.boolean(),
    community_method: z
      .enum(["established_village_moderator_endorsement", "staff_review"])
      .nullable(),
    community_statement: z.string().min(10).max(240).nullable(),
    community_request_status: z
      .enum(["pending", "endorsed", "approved", "rejected", "withdrawn"])
      .nullable(),
    meeting_safety_acknowledged: z.boolean(),
  })
  .strict();

export const trustActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("sync_auth") }).strict(),
  z
    .object({
      action: z.literal("acknowledge_meeting_safety"),
      context: z.enum(["event_rsvp", "connection_meeting", "settings"]),
    })
    .strict(),
  z
    .object({
      action: z.literal("request_community_verification"),
      village_id: z.string().uuid(),
    })
    .strict(),
  z
    .object({
      action: z.literal("endorse_community_verification"),
      request_id: z.string().uuid(),
    })
    .strict(),
]);

export const villageVerificationRequestSchema = z
  .object({
    request_id: z.string().uuid(),
    profile_display_name: z.string().min(2).max(80),
    family_name: z.string().min(2).max(100),
    requested_at: z.string().datetime({ offset: true }),
  })
  .strict();

export const adminVerificationRequestSchema = z
  .object({
    request_id: z.string().uuid(),
    profile_id: z.string().uuid(),
    profile_display_name: z.string().min(2).max(80),
    family_name: z.string().min(2).max(100),
    village_name: z.string().min(3).max(100),
    status: z.literal("pending"),
    requested_at: z.string().datetime({ offset: true }),
  })
  .strict();

export const meetingConfirmationSchema = z
  .object({ safety_acknowledged: z.boolean().optional().default(false) })
  .strict();

export type TrustStatus = z.infer<typeof trustStatusSchema>;
export type VillageVerificationRequest = z.infer<
  typeof villageVerificationRequestSchema
>;
