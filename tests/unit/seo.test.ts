import { describe, expect, it } from "vitest";

import {
  getPublicCommunityPage,
  localizedCommunityCity,
  publicCommunityPages,
} from "@/features/seo/public-pages";
import { publicCommunityAggregateSchema } from "@/lib/validation/seo";

describe("Public SEO aggregates", () => {
  it("keeps the acquisition directory to the approved page set", () => {
    expect(publicCommunityPages).toHaveLength(5);
    expect(
      localizedCommunityCity(
        getPublicCommunityPage("cameroonian-families-in-munich")!,
        "de",
      ),
    ).toBe("München");
    expect(getPublicCommunityPage("family-secret-profile")).toBeUndefined();
  });

  it("accepts thresholded counters and rejects identity fields", () => {
    expect(
      publicCommunityAggregateSchema.safeParse({
        page_slug: "cameroonian-families-in-germany",
        city_label: "Germany",
        culture_label: "Cameroonian",
        residence_label: "Germany",
        family_count: 5,
        village_count: null,
        event_count: null,
        published: true,
        last_refreshed_at: "2026-08-11T10:00:00+00:00",
      }).success,
    ).toBe(true);
    expect(
      publicCommunityAggregateSchema.safeParse({
        page_slug: "cameroonian-families-in-germany",
        city_label: "Germany",
        culture_label: "Cameroonian",
        residence_label: "Germany",
        family_count: 5,
        profile_id: "private",
        village_count: null,
        event_count: null,
        published: true,
        last_refreshed_at: "2026-08-11T10:00:00+00:00",
      }).success,
    ).toBe(false);
  });
});
