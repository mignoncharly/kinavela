import { describe, expect, it } from "vitest";

import { invitationCopies } from "@/features/invitations/copy";
import {
  parseCreatedInvitation,
  parsePublicInvitation,
} from "@/features/invitations/results";
import { locales } from "@/lib/i18n/config";
import {
  invitationActionSchema,
  invitationTokenSchema,
} from "@/lib/validation/invitations";

const token = "A".repeat(43);

function paths(value: unknown, prefix = ""): string[] {
  if (typeof value === "string") return [prefix];
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, item]) =>
    paths(item, prefix ? `${prefix}.${key}` : key),
  );
}

describe("invitation contracts", () => {
  it("accepts only 256-bit base64url invitation tokens", () => {
    expect(invitationTokenSchema.safeParse(token).success).toBe(true);
    expect(invitationTokenSchema.safeParse("short").success).toBe(false);
    expect(invitationTokenSchema.safeParse(`${"A".repeat(42)}=`).success).toBe(
      false,
    );
  });

  it("enforces valid link target combinations", () => {
    expect(
      invitationActionSchema.safeParse({
        action: "create",
        invitation_kind: "family_referral",
        village_id: null,
        event_id: null,
        locale: "en",
      }).success,
    ).toBe(true);
    expect(
      invitationActionSchema.safeParse({
        action: "create",
        invitation_kind: "family_referral",
        village_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        event_id: null,
        locale: "en",
      }).success,
    ).toBe(false);
    expect(
      invitationActionSchema.safeParse({
        action: "create",
        invitation_kind: "village",
        village_id: null,
        event_id: null,
        locale: "en",
      }).success,
    ).toBe(false);
  });

  it("keeps the public projection minimal and strict", () => {
    const publicValue = {
      invitation_kind: "village",
      invitation_locale: "en",
      village_name: "Cameroon Families Berlin",
      village_city: "Berlin",
      country_focus_name: "Cameroon",
      event_title: "Family picnic",
      event_starts_at: "2026-09-01T14:00:00+00:00",
      expires_at: "2026-09-10T14:00:00+00:00",
    };
    expect(parsePublicInvitation([publicValue]).success).toBe(true);
    expect(
      parsePublicInvitation([
        { ...publicValue, location_address: "Secret Street 1" },
      ]).success,
    ).toBe(false);
    expect(
      parsePublicInvitation([{ ...publicValue, creator_name: "Private" }])
        .success,
    ).toBe(false);
  });

  it("returns a raw token only from the one-time creation result", () => {
    expect(
      parseCreatedInvitation([
        {
          invitation_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          raw_token: token,
          expires_at: "2026-09-10T14:00:00+00:00",
        },
      ]).success,
    ).toBe(true);
  });

  it("keeps invitation copy complete in German, French, and English", () => {
    const shape = paths(invitationCopies.de);
    for (const locale of locales) {
      expect(paths(invitationCopies[locale])).toEqual(shape);
      expect(Object.values(invitationCopies[locale]).every(Boolean)).toBe(true);
    }
  });
});
