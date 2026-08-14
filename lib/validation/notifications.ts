import { z } from "zod";

export const notificationKindSchema = z.enum([
  "connection_request",
  "connection_accepted",
  "message_received",
  "event_reminder",
  "village_activity",
  "story_ready",
  "compatible_family_available",
  "passport_export_ready",
  "referral_accepted",
  "village_invitation",
  "village_join_request",
  "village_join_decision",
  "event_invitation",
  "event_changed",
  "event_rsvp_update",
  "playdate_proposal",
  "support_response",
  "report_resolved",
  "story_failed",
  "germany_access_opened",
]);

export const notificationFeedSchema = z
  .object({
    notification_id: z.string().uuid(),
    notification_kind: notificationKindSchema,
    entity_type: z.string().min(2).max(42),
    entity_id: z.string().uuid(),
    payload: z.record(z.string(), z.unknown()),
    read_at: z.string().datetime({ offset: true }).nullable(),
    created_at: z.string().datetime({ offset: true }),
  })
  .strict();

export const notificationPreferencesSchema = z
  .object({
    email_enabled: z.boolean(),
    push_enabled: z.boolean(),
    push_subscription_count: z.number().int().nonnegative(),
    community_enabled: z.boolean(),
    events_enabled: z.boolean(),
    direct_enabled: z.boolean(),
    heritage_enabled: z.boolean(),
    safety_enabled: z.boolean(),
  })
  .strict();

export const notificationPreferencesActionSchema = z
  .object({
    email_enabled: z.boolean(),
    push_enabled: z.boolean(),
    community_enabled: z.boolean(),
    events_enabled: z.boolean(),
    direct_enabled: z.boolean(),
    heritage_enabled: z.boolean(),
    safety_enabled: z.boolean(),
  })
  .strict();

export const pushSubscriptionSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("register"),
      endpoint: z.string().url().max(2048),
      p256dh: z.string().min(20).max(512),
      auth: z.string().min(10).max(256),
    })
    .strict(),
  z
    .object({
      action: z.literal("revoke"),
      endpoint: z.string().url().max(2048),
    })
    .strict(),
]);

export type NotificationFeedItem = z.infer<typeof notificationFeedSchema>;
export type NotificationPreferences = z.infer<
  typeof notificationPreferencesSchema
>;

export function parseNotificationFeed(value: unknown) {
  return notificationFeedSchema.array().safeParse(value);
}
