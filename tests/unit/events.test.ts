import { describe, expect, it } from "vitest";

import { parseEventResults } from "@/features/events/results";
import { eventActionSchema, eventCreateSchema } from "@/lib/validation/events";

const eventId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const villageId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const input = {
  village_id: villageId,
  title: "Cameroon family picnic",
  description: "A relaxed afternoon for all Village families.",
  category: "picnic",
  starts_at: "2026-09-20T12:00:00.000Z",
  ends_at: "2026-09-20T16:00:00.000Z",
  location_name: "Klenzepark",
  location_city: "Ingolstadt",
  location_address: "Brückenkopf 4, 85051 Ingolstadt",
  public_location_description: "A central park in Ingolstadt",
  address_visibility: "going",
  max_families: 8,
  registration_deadline: "2026-09-19T12:00:00.000Z",
};

describe("Phase 8 event contracts", () => {
  it("accepts a bounded event with an explicitly private address rule", () => {
    expect(eventCreateSchema.safeParse(input).success).toBe(true);
  });

  it("rejects an end time before the event starts", () => {
    expect(
      eventCreateSchema.safeParse({
        ...input,
        ends_at: "2026-09-20T10:00:00.000Z",
      }).success,
    ).toBe(false);
  });

  it("rejects invalid family party sizes", () => {
    expect(
      eventActionSchema.safeParse({
        action: "rsvp",
        event_id: eventId,
        status: "going",
        number_of_adults: 0,
        number_of_children: 0,
      }).success,
    ).toBe(false);
  });

  it("rejects a result that claims hidden address access while returning it", () => {
    const parsed = parseEventResults([
      {
        event_id: eventId,
        village_id: villageId,
        title: input.title,
        description: input.description,
        category: input.category,
        starts_at: input.starts_at,
        ends_at: input.ends_at,
        location_name: input.location_name,
        location_city: input.location_city,
        public_location_description: input.public_location_description,
        location_address: input.location_address,
        address_visible: false,
        address_visibility: "going",
        max_families: 8,
        registration_deadline: input.registration_deadline,
        status: "scheduled",
        creator_family_name: "Picnic Family",
        current_rsvp_status: null,
        number_of_adults: null,
        number_of_children: null,
        going_count: 0,
        maybe_count: 0,
        waitlist_count: 0,
        attended_count: 0,
        can_manage: false,
        reminder_unread: false,
        latest_reminder_kind: null,
      },
    ]);
    expect(parsed.success).toBe(false);
  });
});
