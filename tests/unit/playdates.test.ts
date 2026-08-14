import { describe, expect, it } from "vitest";

import { parsePlaydates } from "@/features/playdates/results";
import {
  eventMessageSchema,
  playdateActionSchema,
  playdateCreateSchema,
} from "@/lib/validation/playdates";

const uuid = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("Phase 8 private activity contracts", () => {
  it("accepts one to three distinct private playdate options", () => {
    expect(
      playdateCreateSchema.safeParse({
        connection_id: uuid,
        title: "Park afternoon",
        approximate_location: "Near Tiergarten",
        exact_address: "Private Street 5, Berlin",
        time_options: ["2026-09-20T12:00:00.000Z", "2026-09-21T12:00:00.000Z"],
        number_of_adults: 1,
        number_of_children: 2,
      }).success,
    ).toBe(true);
  });

  it("rejects duplicate options and empty attendance", () => {
    const option = "2026-09-20T12:00:00.000Z";
    expect(
      playdateCreateSchema.safeParse({
        connection_id: uuid,
        title: "Park afternoon",
        approximate_location: "Near Tiergarten",
        exact_address: "Private Street 5, Berlin",
        time_options: [option, option],
        number_of_adults: 0,
        number_of_children: 0,
      }).success,
    ).toBe(false);
  });

  it("requires a selected option when accepting", () => {
    expect(
      playdateActionSchema.safeParse({
        action: "accept",
        playdate_id: uuid,
        option_id: uuid,
        number_of_adults: 1,
        number_of_children: 1,
      }).success,
    ).toBe(true);
  });

  it("limits event coordination messages", () => {
    expect(
      eventMessageSchema.safeParse({ event_id: uuid, body: "Meet at 3?" })
        .success,
    ).toBe(true);
    expect(
      eventMessageSchema.safeParse({ event_id: uuid, body: "x".repeat(2001) })
        .success,
    ).toBe(false);
  });

  it("rejects an accepted result without its protected address", () => {
    const parsed = parsePlaydates([
      {
        playdate_id: uuid,
        connection_id: uuid,
        other_family_id: uuid,
        other_family_name: "Other Family",
        title: "Park afternoon",
        approximate_location: "Near Tiergarten",
        exact_address: null,
        status: "accepted",
        is_proposer: true,
        time_options: [
          { option_id: uuid, starts_at: "2026-09-20T12:00:00.000Z" },
        ],
        selected_option_id: uuid,
        selected_starts_at: "2026-09-20T12:00:00.000Z",
        proposer_adults: 1,
        proposer_children: 2,
        recipient_adults: 1,
        recipient_children: 1,
        reminder_unread: false,
        latest_reminder_kind: null,
        created_at: "2026-08-13T12:00:00.000Z",
      },
    ]);
    expect(parsed.success).toBe(false);
  });
});
