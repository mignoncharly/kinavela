import { z } from "zod";

const optionSchema = z
  .object({
    option_id: z.string().uuid(),
    starts_at: z.string().datetime({ offset: true }),
  })
  .strict();

export const playdateResultSchema = z
  .object({
    playdate_id: z.string().uuid(),
    connection_id: z.string().uuid(),
    other_family_id: z.string().uuid(),
    other_family_name: z.string().min(2).max(100),
    title: z.string().min(3).max(120),
    approximate_location: z.string().min(2).max(240),
    exact_address: z.string().min(5).max(300).nullable(),
    status: z.enum(["proposed", "accepted", "declined", "cancelled"]),
    is_proposer: z.boolean(),
    time_options: z.array(optionSchema).min(1).max(3),
    selected_option_id: z.string().uuid().nullable(),
    selected_starts_at: z.string().datetime({ offset: true }).nullable(),
    proposer_adults: z.number().int().min(0).max(10),
    proposer_children: z.number().int().min(0).max(20),
    recipient_adults: z.number().int().min(0).max(10).nullable(),
    recipient_children: z.number().int().min(0).max(20).nullable(),
    reminder_unread: z.boolean(),
    latest_reminder_kind: z
      .enum(["scheduled_24h", "organizer", "cancelled"])
      .nullable(),
    created_at: z.string().datetime({ offset: true }),
  })
  .strict()
  .superRefine((value, context) => {
    if ((value.status === "accepted") !== (value.exact_address !== null))
      context.addIssue({ code: "custom", message: "address_contract" });
  });

export const eventMessageResultSchema = z
  .object({
    message_id: z.string().uuid(),
    sender_display_name: z.string().min(2).max(80),
    body: z.string().max(2000),
    created_at: z.string().datetime({ offset: true }),
    is_own_family: z.boolean(),
  })
  .strict();

export type PlaydateResult = z.infer<typeof playdateResultSchema>;
export type EventMessageResult = z.infer<typeof eventMessageResultSchema>;
export const parsePlaydates = (value: unknown) =>
  playdateResultSchema.array().safeParse(value);
export const parseEventMessages = (value: unknown) =>
  eventMessageResultSchema.array().safeParse(value);
