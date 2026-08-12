import { describe, expect, it } from "vitest";

import {
  parseVillageDetail,
  parseVillageMembers,
} from "@/features/villages/results";
import {
  villageCreateSchema,
  villageMembershipActionSchema,
  villageMessageSchema,
  villageReportResolutionSchema,
} from "@/lib/validation/villages";

const villageId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const familyId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const conversationId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

describe("Village contracts", () => {
  it("normalizes valid creation and message input", () => {
    expect(
      villageCreateSchema.safeParse({
        name: "  Cameroon Families Berlin  ",
        description: "  A private local community for families.  ",
        radius_km: 40,
        member_limit: 30,
      }).data,
    ).toMatchObject({
      name: "Cameroon Families Berlin",
      description: "A private local community for families.",
      village_type: "local",
      visibility: "listed",
    });
    expect(
      villageMessageSchema.safeParse({
        village_id: villageId,
        body: "  Welcome families  ",
      }).data?.body,
    ).toBe("Welcome families");
  });

  it("rejects invalid limits, roles and moderation actions", () => {
    expect(
      villageCreateSchema.safeParse({
        name: "Village",
        description: "A valid description",
        member_limit: 2,
      }).success,
    ).toBe(false);
    expect(
      villageMembershipActionSchema.safeParse({
        action: "set_role",
        village_id: villageId,
        family_id: familyId,
        role: "admin",
      }).success,
    ).toBe(false);
    expect(
      villageReportResolutionSchema.safeParse({
        report_id: villageId,
        resolution: "publish_message",
      }).success,
    ).toBe(false);
  });

  it("accepts only the privacy-safe Village detail projection", () => {
    const detail = {
      village_id: villageId,
      name: "Cameroon Families Berlin",
      description: "A private local community for families.",
      city: "Berlin",
      village_type: "local",
      country_focus_name: "Cameroon",
      radius_km: 40,
      visibility: "listed",
      member_limit: 30,
      member_count: 3,
      member_role: "owner",
      conversation_id: conversationId,
      muted: false,
      can_moderate: true,
      can_manage_roles: true,
    };
    expect(parseVillageDetail([detail]).success).toBe(true);
    expect(
      parseVillageDetail([{ ...detail, center_location: "private" }]).success,
    ).toBe(false);
  });

  it("accepts member summaries without guardian or child fields", () => {
    const member = {
      family_id: familyId,
      family_name: "Nkom Family",
      city: "Berlin",
      role: "member",
      joined_at: "2026-08-09T20:00:00+00:00",
      is_current_family: false,
    };
    expect(parseVillageMembers([member]).success).toBe(true);
    expect(
      parseVillageMembers([{ ...member, guardian_email: "private" }]).success,
    ).toBe(false);
  });
});
