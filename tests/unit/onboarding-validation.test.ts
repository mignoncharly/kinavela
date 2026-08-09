import { describe, expect, it } from "vitest";

import { onboardingSchema } from "@/lib/validation/onboarding";

const validPayload = {
  display_name: "Nkom Family",
  preferred_language: "en",
  timezone: "Europe/Berlin",
  family: {
    name: "Nkom Family",
    country_of_residence: "DE",
    city: "Berlin",
    radius_km: 40,
    visibility: "discoverable",
    bio: "Our family",
  },
  children: [
    {
      nickname: "Little Root",
      birth_year: 2020,
      birth_month: null,
      gender: null,
    },
  ],
  culture_ids: ["20000000-0000-4000-8000-000000000001"],
  languages: [
    {
      language_id: "30000000-0000-4000-8000-000000000003",
      proficiency: "fluent",
      transmission_goal: "want_to_teach_children",
    },
  ],
  preservation_goals: ["language"],
  interest_ids: ["40000000-0000-4000-8000-000000000001"],
  availability: [{ weekday: 6, period: "afternoon" }],
  preferences: {
    open_to_other_african_families: true,
    open_to_all_diaspora_families: false,
    min_child_age: 0,
    max_child_age: 12,
  },
  accept_community_guidelines: true,
} as const;

describe("family onboarding validation", () => {
  it("accepts a complete privacy-conscious family profile", () => {
    expect(onboardingSchema.safeParse(validPayload).success).toBe(true);
  });

  it("does not allow onboarding without a child or community consent", () => {
    expect(
      onboardingSchema.safeParse({ ...validPayload, children: [] }).success,
    ).toBe(false);
    expect(
      onboardingSchema.safeParse({
        ...validPayload,
        accept_community_guidelines: false,
      }).success,
    ).toBe(false);
  });
});
