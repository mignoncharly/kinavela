import { z } from "zod";

import { eventCategories, eventRsvpStatuses } from "@/lib/validation/events";

export const eventResultSchema = z
  .object({
    event_id: z.string().uuid(),
    village_id: z.string().uuid(),
    title: z.string().min(3).max(120),
    description: z.string().min(10).max(2000),
    category: z.enum(eventCategories),
    starts_at: z.string().datetime({ offset: true }),
    ends_at: z.string().datetime({ offset: true }),
    location_name: z.string().min(2).max(120),
    location_city: z.string().min(2).max(120),
    public_location_description: z.string().min(2).max(240),
    location_address: z.string().min(5).max(300).nullable(),
    address_visible: z.boolean(),
    address_visibility: z.enum(["going", "all_members"]),
    max_families: z.number().int().min(1).max(100).nullable(),
    registration_deadline: z.string().datetime({ offset: true }),
    status: z.enum(["scheduled", "cancelled", "completed"]),
    creator_family_name: z.string().min(2).max(100),
    current_rsvp_status: z.enum(eventRsvpStatuses).nullable(),
    number_of_adults: z.number().int().min(0).max(10).nullable(),
    number_of_children: z.number().int().min(0).max(20).nullable(),
    going_count: z.number().int().min(0),
    maybe_count: z.number().int().min(0),
    waitlist_count: z.number().int().min(0),
    attended_count: z.number().int().min(0),
    can_manage: z.boolean(),
    reminder_unread: z.boolean(),
    latest_reminder_kind: z
      .enum([
        "scheduled_24h",
        "organizer",
        "event_updated",
        "event_cancelled",
        "waitlist_promoted",
      ])
      .nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.address_visible !== (value.location_address !== null)) {
      context.addIssue({ code: "custom", message: "address_contract" });
    }
  });

export const eventAttendeeResultSchema = z
  .object({
    family_id: z.string().uuid(),
    family_name: z.string().min(2).max(100),
    status: z.enum(eventRsvpStatuses),
    number_of_adults: z.number().int().min(0).max(10),
    number_of_children: z.number().int().min(0).max(20),
    attendance_confirmed: z.boolean(),
    rsvp_at: z.string().datetime({ offset: true }),
  })
  .strict();

export type EventResult = z.infer<typeof eventResultSchema>;
export type EventAttendeeResult = z.infer<typeof eventAttendeeResultSchema>;

export const parseEventResults = (value: unknown) =>
  eventResultSchema.array().safeParse(value);
export const parseEventAttendees = (value: unknown) =>
  eventAttendeeResultSchema.array().safeParse(value);
