import { z } from "zod";

const connectionBase = z.object({
  connection_id: z.string().uuid(),
  other_family_id: z.string().uuid(),
  family_name: z.string().min(2).max(100),
  display_city: z.string().min(2).max(120),
  country_code: z.string().regex(/^[A-Z]{2}$/),
  direction: z.enum(["incoming", "outgoing"]),
  requested_at: z.string().datetime({ offset: true }),
});

export const connectionResultSchema = z.discriminatedUnion("status", [
  connectionBase
    .extend({
      status: z.literal("requested"),
      accepted_at: z.null(),
      bio: z.null(),
      guardian_names: z.array(z.never()).length(0),
    })
    .strict(),
  connectionBase
    .extend({
      status: z.literal("accepted"),
      accepted_at: z.string().datetime({ offset: true }),
      bio: z.string().max(600).nullable(),
      guardian_names: z.array(z.string().min(2).max(80)),
    })
    .strict(),
]);

export const notificationResultSchema = z
  .object({
    notification_id: z.string().uuid(),
    notification_type: z.enum([
      "connection_request",
      "connection_accepted",
      "message_received",
    ]),
    actor_family_id: z.string().uuid(),
    actor_family_name: z.string().min(2).max(100),
    connection_id: z.string().uuid(),
    read_at: z.string().datetime({ offset: true }).nullable(),
    created_at: z.string().datetime({ offset: true }),
  })
  .strict();

export type ConnectionResult = z.infer<typeof connectionResultSchema>;
export type NotificationResult = z.infer<typeof notificationResultSchema>;

export function parseConnectionResults(value: unknown) {
  return connectionResultSchema.array().safeParse(value);
}

export function parseNotificationResults(value: unknown) {
  return notificationResultSchema.array().safeParse(value);
}
