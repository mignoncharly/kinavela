import { describe, expect, it } from "vitest";

import { trustCopyParity } from "@/features/trust/copy";
import { eventReportReasons, reportSchema } from "@/lib/validation/messaging";
import {
  meetingConfirmationSchema,
  trustActionSchema,
  trustStatusSchema,
} from "@/lib/validation/trust";

describe("Phase 6 trust and child-meeting safety contracts", () => {
  it("accepts every fixed event reason and rejects generic unsafe event input", () => {
    for (const reason of eventReportReasons) {
      expect(
        reportSchema.safeParse({
          target_type: "event",
          target_id: "a0000000-0000-4000-8000-000000000001",
          reason,
          details: "",
        }).success,
      ).toBe(true);
    }
    expect(
      reportSchema.safeParse({
        target_type: "event",
        target_id: "a0000000-0000-4000-8000-000000000001",
        reason: "harassment",
      }).success,
    ).toBe(false);
  });

  it("keeps trust actions resource-bound and strict", () => {
    expect(
      trustActionSchema.safeParse({
        action: "acknowledge_meeting_safety",
        context: "event_rsvp",
      }).success,
    ).toBe(true);
    expect(
      trustActionSchema.safeParse({
        action: "request_community_verification",
        village_id: "a0000000-0000-4000-8000-000000000001",
        profile_id: "b0000000-0000-4000-8000-000000000001",
      }).success,
    ).toBe(false);
  });

  it("exposes only exact verification state, never phone or email values", () => {
    const safe = {
      email_verified: true,
      phone_verified: false,
      community_verified: true,
      community_method: "staff_review" as const,
      community_statement: "Kinavela staff reviewed the adult profile request.",
      community_request_status: "approved" as const,
      meeting_safety_acknowledged: true,
    };
    expect(trustStatusSchema.safeParse(safe).success).toBe(true);
    expect(
      trustStatusSchema.safeParse({ ...safe, phone: "+491234567890" }).success,
    ).toBe(false);
  });

  it("requires an explicit, strict meeting confirmation payload", () => {
    expect(meetingConfirmationSchema.parse({})).toEqual({
      safety_acknowledged: false,
    });
    expect(
      meetingConfirmationSchema.safeParse({
        safety_acknowledged: true,
        connection_id: "a0000000-0000-4000-8000-000000000001",
      }).success,
    ).toBe(false);
  });

  it("keeps German, French and English safety guidance in parity", () => {
    const keySets = Object.values(trustCopyParity).map((value) =>
      Object.keys(value).sort(),
    );
    expect(keySets[1]).toEqual(keySets[0]);
    expect(keySets[2]).toEqual(keySets[0]);
    expect(trustCopyParity.de.safetyItems).toHaveLength(6);
    expect(trustCopyParity.fr.safetyItems).toHaveLength(6);
    expect(trustCopyParity.en.safetyItems).toHaveLength(6);
    expect(trustCopyParity.en.intro.toLowerCase()).toContain("does not mean");
  });
});
