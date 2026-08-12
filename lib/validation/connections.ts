import { z } from "zod";

export const connectionRequestSchema = z.object({
  family_id: z.string().uuid(),
});

export const connectionResponseSchema = z.object({
  accept: z.boolean(),
});

export const connectionIdSchema = z.string().uuid();

export const notificationReadSchema = z.object({
  notification_id: z.string().uuid(),
});
