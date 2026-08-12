import { describe, expect, it } from "vitest";

import {
  parseConnectionResults,
  parseNotificationResults,
} from "@/features/connections/results";
import {
  connectionRequestSchema,
  connectionResponseSchema,
  notificationReadSchema,
} from "@/lib/validation/connections";

const connectionId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const familyId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const pendingConnection = {
  connection_id: connectionId,
  other_family_id: familyId,
  family_name: "Nkom Family",
  display_city: "Berlin",
  country_code: "DE",
  status: "requested",
  direction: "incoming",
  requested_at: "2026-08-09T12:00:00+00:00",
  accepted_at: null,
  bio: null,
  guardian_names: [],
};

describe("family connection contracts", () => {
  it("accepts connection actions with explicit UUIDs and decisions", () => {
    expect(
      connectionRequestSchema.safeParse({ family_id: familyId }).success,
    ).toBe(true);
    expect(connectionResponseSchema.safeParse({ accept: true }).success).toBe(
      true,
    );
    expect(
      notificationReadSchema.safeParse({ notification_id: connectionId })
        .success,
    ).toBe(true);
  });

  it("rejects malformed or ambiguous connection actions", () => {
    expect(
      connectionRequestSchema.safeParse({ family_id: "family" }).success,
    ).toBe(false);
    expect(connectionResponseSchema.safeParse({ accept: "yes" }).success).toBe(
      false,
    );
  });

  it("enforces pending and accepted privacy projections", () => {
    expect(parseConnectionResults([pendingConnection]).success).toBe(true);
    expect(
      parseConnectionResults([
        {
          ...pendingConnection,
          status: "accepted",
          accepted_at: "2026-08-09T13:00:00+00:00",
          bio: "We love family hikes.",
          guardian_names: ["Mireille"],
        },
      ]).success,
    ).toBe(true);
    expect(
      parseConnectionResults([
        { ...pendingConnection, email: "private@example.com" },
      ]).success,
    ).toBe(false);
  });

  it("validates the minimal notification projection", () => {
    expect(
      parseNotificationResults([
        {
          notification_id: connectionId,
          notification_type: "connection_request",
          actor_family_id: familyId,
          actor_family_name: "Nkom Family",
          connection_id: connectionId,
          read_at: null,
          created_at: "2026-08-09T12:00:00+00:00",
        },
      ]).success,
    ).toBe(true);
  });
});
