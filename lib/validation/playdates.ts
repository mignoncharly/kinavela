import { z } from "zod";

const uuid = z.string().uuid();
const party = {
  number_of_adults: z.number().int().min(0).max(10),
  number_of_children: z.number().int().min(0).max(20),
};
const validParty = (value: {
  number_of_adults: number;
  number_of_children: number;
}) =>
  value.number_of_adults + value.number_of_children >= 1 &&
  value.number_of_adults + value.number_of_children <= 30;

export const playdateCreateSchema = z
  .object({
    connection_id: uuid,
    title: z.string().trim().min(3).max(120),
    approximate_location: z.string().trim().min(2).max(240),
    exact_address: z.string().trim().min(5).max(300),
    time_options: z
      .array(z.string().datetime({ offset: true }))
      .min(1)
      .max(3),
    ...party,
  })
  .strict()
  .refine(validParty, { path: ["number_of_adults"], message: "invalid_party" })
  .refine(
    (value) => new Set(value.time_options).size === value.time_options.length,
    {
      path: ["time_options"],
      message: "duplicate_time",
    },
  );

export const playdateActionSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("accept"),
      playdate_id: uuid,
      option_id: uuid,
      ...party,
    })
    .strict()
    .refine(validParty, {
      path: ["number_of_adults"],
      message: "invalid_party",
    }),
  z.object({ action: z.literal("decline"), playdate_id: uuid }).strict(),
  z.object({ action: z.literal("cancel"), playdate_id: uuid }).strict(),
  z.object({ action: z.literal("remind"), playdate_id: uuid }).strict(),
  z.object({ action: z.literal("read_reminders"), playdate_id: uuid }).strict(),
  z
    .object({
      action: z.literal("report"),
      playdate_id: uuid,
      reason: z.enum([
        "unsafe_location",
        "inappropriate_conduct",
        "child_safety_concern",
        "discrimination",
        "fraud",
        "other",
      ]),
      details: z.string().trim().max(900).default(""),
    })
    .strict(),
]);

export const eventMessageSchema = z
  .object({
    event_id: uuid,
    body: z.string().trim().min(1).max(2000),
  })
  .strict();
