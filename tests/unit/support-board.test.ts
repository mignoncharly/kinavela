import { describe, expect, it } from "vitest";

import { supportCopyParity } from "@/features/villages/support-copy";
import { supportPostSchema } from "@/features/villages/support-results";
import {
  supportActionSchema,
  supportCategories,
  supportContentTypes,
  supportReportReasons,
} from "@/lib/validation/support";

const id = "a0000000-0000-4000-8000-000000000001";

describe("Phase 7 Village support contracts", () => {
  it("covers every approved practical content type and category", () => {
    expect(supportContentTypes).toHaveLength(6);
    expect(supportCategories).toHaveLength(11);
    expect(supportContentTypes).toContain("offer_of_help");
    expect(supportCategories).toContain("immigration_integration");
    expect(supportCategories).toContain("healthcare_navigation");
  });

  it("requires explicit privacy confirmation for posts and replies", () => {
    expect(
      supportActionSchema.safeParse({
        action: "create",
        village_id: id,
        content_type: "question",
        category: "kita",
        title: "Kita registration",
        body: "How did your family prepare the application?",
        privacy_confirmed: true,
      }).success,
    ).toBe(true);
    expect(
      supportActionSchema.safeParse({
        action: "reply",
        post_id: id,
        body: "We used the municipal information page.",
        privacy_confirmed: false,
      }).success,
    ).toBe(false);
  });

  it("uses fixed reports and exactly one moderation target", () => {
    for (const reason of supportReportReasons) {
      expect(
        supportActionSchema.safeParse({
          action: "report",
          post_id: id,
          reason,
          details: "",
        }).success,
      ).toBe(true);
    }
    expect(
      supportActionSchema.safeParse({
        action: "moderate",
        post_id: id,
        reply_id: id,
        reason: "outdated",
      }).success,
    ).toBe(false);
  });

  it("keeps the client DTO minimal", () => {
    const safe = {
      post_id: id,
      content_type: "question",
      category: "kita",
      title: "Kita registration",
      body: "How did your family prepare the application?",
      status: "open",
      author_family_name: "Example Family",
      is_author: true,
      can_moderate: false,
      reply_count: 0,
      replies: [],
      resolved_at: null,
      created_at: "2026-08-13T12:00:00.000Z",
    };
    expect(supportPostSchema.safeParse(safe).success).toBe(true);
    expect(
      supportPostSchema.safeParse({
        ...safe,
        author_profile_id: id,
        phone: "+4915111111111",
      }).success,
    ).toBe(false);
  });

  it("keeps German, French and English copy in parity", () => {
    const keys = Object.values(supportCopyParity).map((value) =>
      Object.keys(value).sort(),
    );
    expect(keys[1]).toEqual(keys[0]);
    expect(keys[2]).toEqual(keys[0]);
    expect(supportCopyParity.en.intro).toContain("without likes");
  });
});
