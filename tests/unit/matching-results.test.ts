import { describe, expect, it } from "vitest";

import { parseMatchResults } from "@/features/matching/results";

const validResult = {
  family_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  family_name: "Nkom Family",
  display_city: "Berlin area",
  distance_bucket: "5-10 km",
  match_score: 91,
  child_age_ranges: ["3-5"],
  cultures: ["Cameroon"],
  languages: ["French"],
  shared_interests: ["playdates"],
  compatibility_reasons: ["children_similar_age", "shared_culture", "nearby"],
};

describe("matching result contract", () => {
  it("accepts the privacy-safe deterministic result projection", () => {
    expect(parseMatchResults([validResult]).success).toBe(true);
  });

  it("rejects invalid scores and unknown explanation keys", () => {
    expect(
      parseMatchResults([{ ...validResult, match_score: 101 }]).success,
    ).toBe(false);
    expect(
      parseMatchResults([
        { ...validResult, compatibility_reasons: ["opaque_ai_reason"] },
      ]).success,
    ).toBe(false);
  });
});
