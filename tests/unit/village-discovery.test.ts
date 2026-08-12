import { describe, expect, it } from "vitest";

import { parseVillageClusterRecommendations } from "@/features/village-discovery/results";
import { villageRecommendationActionSchema } from "@/lib/validation/village-discovery";

const countryId = "10000000-0000-4000-8000-000000000001";

describe("Village discovery contracts", () => {
  it("accepts only aggregate recommendation fields", () => {
    const recommendation = {
      country_id: countryId,
      country_name: "Cameroon",
      city: "Ingolstadt",
      family_count: 7,
      child_age_ranges: ["0-2", "3-5", "6-8"],
      radius_km: 30,
    };
    expect(parseVillageClusterRecommendations([recommendation]).success).toBe(
      true,
    );
    expect(
      parseVillageClusterRecommendations([
        { ...recommendation, family_ids: [crypto.randomUUID()] },
      ]).success,
    ).toBe(false);
    expect(
      parseVillageClusterRecommendations([
        { ...recommendation, center_location: "48.766,11.425" },
      ]).success,
    ).toBe(false);
  });

  it("enforces the cluster threshold in the result contract", () => {
    expect(
      parseVillageClusterRecommendations([
        {
          country_id: countryId,
          country_name: "Cameroon",
          city: "Ingolstadt",
          family_count: 6,
          child_age_ranges: ["0-2", "3-5", "6-8"],
          radius_km: 30,
        },
      ]).success,
    ).toBe(false);
  });

  it("validates explicit start and dismiss consent actions", () => {
    expect(
      villageRecommendationActionSchema.safeParse({
        action: "start",
        country_id: countryId,
        name: "  Cameroon Families · Ingolstadt  ",
        description: "  A private local community for nearby families.  ",
      }).data,
    ).toMatchObject({
      name: "Cameroon Families · Ingolstadt",
      description: "A private local community for nearby families.",
    });
    expect(
      villageRecommendationActionSchema.safeParse({
        action: "dismiss",
        country_id: countryId,
        name: "unexpected",
      }).success,
    ).toBe(false);
  });
});
