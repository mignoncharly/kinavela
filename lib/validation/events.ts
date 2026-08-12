import { z } from "zod";

export const eventCategories = [
  "playdate",
  "park",
  "picnic",
  "cooking",
  "language",
  "cultural",
  "sports",
  "creative",
  "family_support",
  "celebration",
  "other",
] as const;

export const eventRsvpStatuses = [
  "going",
  "maybe",
  "declined",
  "waitlisted",
] as const;

const eventFields = {
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(2000),
  category: z.enum(eventCategories),
  starts_at: z.string().datetime({ offset: true }),
  ends_at: z.string().datetime({ offset: true }),
  location_name: z.string().trim().min(2).max(120),
  location_city: z.string().trim().min(2).max(120),
  location_address: z.string().trim().min(5).max(300),
  public_location_description: z.string().trim().min(2).max(240),
  address_visibility: z.enum(["going", "all_members"]),
  max_families: z.number().int().min(1).max(100).nullable(),
  registration_deadline: z.string().datetime({ offset: true }),
};

const validEventTimes = (value: {
  starts_at: string;
  ends_at: string;
  registration_deadline: string;
}) =>
  new Date(value.starts_at).getTime() < new Date(value.ends_at).getTime() &&
  new Date(value.registration_deadline).getTime() <=
    new Date(value.starts_at).getTime();

export const eventCreateSchema = z
  .object({ village_id: z.string().uuid(), ...eventFields })
  .strict()
  .refine(validEventTimes, { path: ["ends_at"], message: "invalid_time" });

export const eventUpdateSchema = z
  .object({ event_id: z.string().uuid(), ...eventFields })
  .strict()
  .refine(validEventTimes, { path: ["ends_at"], message: "invalid_time" });

export const eventActionSchema = z.discriminatedUnion("action", [
  z
    .object({ action: z.literal("cancel"), event_id: z.string().uuid() })
    .strict(),
  z
    .object({ action: z.literal("remind"), event_id: z.string().uuid() })
    .strict(),
  z
    .object({
      action: z.literal("rsvp"),
      event_id: z.string().uuid(),
      status: z.enum(["going", "maybe", "declined"]),
      number_of_adults: z.number().int().min(0).max(10),
      number_of_children: z.number().int().min(0).max(20),
    })
    .strict()
    .refine(
      (value) =>
        value.number_of_adults + value.number_of_children >= 1 &&
        value.number_of_adults + value.number_of_children <= 30,
      { path: ["number_of_adults"], message: "invalid_party_size" },
    ),
  z
    .object({
      action: z.literal("attendance"),
      event_id: z.string().uuid(),
      family_id: z.string().uuid(),
      attended: z.boolean(),
    })
    .strict(),
  z
    .object({
      action: z.literal("read_reminders"),
      event_id: z.string().uuid(),
    })
    .strict(),
]);
