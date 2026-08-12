import { z } from "zod";

export const conversationResultSchema = z
  .object({
    conversation_id: z.string().uuid(),
    other_family_id: z.string().uuid(),
    other_family_name: z.string().min(2).max(100),
    last_message_preview: z.string().max(160).nullable(),
    last_message_at: z.string().datetime({ offset: true }).nullable(),
    unread_count: z.number().int().min(0),
    muted: z.boolean(),
  })
  .strict();

export const messageResultSchema = z
  .object({
    message_id: z.string().uuid(),
    conversation_id: z.string().uuid(),
    sender_profile_id: z.string().uuid(),
    sender_family_id: z.string().uuid(),
    sender_display_name: z.string().min(2).max(80),
    body: z.string().min(1).max(2000),
    reply_to: z.string().uuid().nullable(),
    is_own_family: z.boolean(),
    created_at: z.string().datetime({ offset: true }),
  })
  .strict();

export type ConversationResult = z.infer<typeof conversationResultSchema>;
export type MessageResult = z.infer<typeof messageResultSchema>;

export function parseConversationResults(value: unknown) {
  return conversationResultSchema.array().safeParse(value);
}

export function parseMessageResults(value: unknown) {
  return messageResultSchema.array().safeParse(value);
}
