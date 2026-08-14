import { describe, expect, it } from "vitest";

import { discoveryActivationCopies } from "@/features/discovery-activation/copy";
import { parseDiscoveryAlert } from "@/features/discovery-activation/results";
import { locales } from "@/lib/i18n/config";
import { discoveryAlertActionSchema } from "@/lib/validation/discovery-alerts";

function paths(value: unknown, prefix = ""): string[] {
  if (typeof value === "string") return [prefix];
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, item]) =>
    paths(item, prefix ? `${prefix}.${key}` : key),
  );
}

describe("discovery activation contracts", () => {
  it("accepts explicit bounded subscriptions and revocation", () => {
    expect(
      discoveryAlertActionSchema.safeParse({
        action: "subscribe",
        radius_km: 40,
      }).success,
    ).toBe(true);
    expect(
      discoveryAlertActionSchema.safeParse({
        action: "subscribe",
        radius_km: 101,
      }).success,
    ).toBe(false);
    expect(
      discoveryAlertActionSchema.safeParse({ action: "revoke" }).success,
    ).toBe(true);
  });

  it("keeps subscription projections free of family and candidate identity", () => {
    const alert = {
      subscription_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      active: true,
      radius_km: 40,
      last_evaluated_at: null,
      created_at: "2026-08-13T12:00:00+00:00",
    };
    expect(parseDiscoveryAlert([alert]).success).toBe(true);
    expect(
      parseDiscoveryAlert([{ ...alert, candidate_family_id: "private" }])
        .success,
    ).toBe(false);
    expect(
      parseDiscoveryAlert([{ ...alert, family_name: "private" }]).success,
    ).toBe(false);
  });

  it("keeps German, French, and English activation copy in parity", () => {
    const shape = paths(discoveryActivationCopies.de);
    for (const locale of locales) {
      expect(paths(discoveryActivationCopies[locale])).toEqual(shape);
      expect(
        Object.values(discoveryActivationCopies[locale]).every(Boolean),
      ).toBe(true);
    }
  });
});
