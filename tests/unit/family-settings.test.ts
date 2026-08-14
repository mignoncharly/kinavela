import { describe, expect, it } from "vitest";

import { familySettingsSchema } from "@/lib/validation/family-settings";
import { validFamilySettings } from "@/tests/fixtures/family-settings";

describe("family settings validation", () => {
  it("accepts multiple languages and availability slots", () => {
    expect(familySettingsSchema.safeParse(validFamilySettings).success).toBe(
      true,
    );
  });

  it("requires child-safe core family information", () => {
    expect(
      familySettingsSchema.safeParse({
        ...validFamilySettings,
        children: [],
      }).success,
    ).toBe(false);
    expect(
      familySettingsSchema.safeParse({
        ...validFamilySettings,
        preservation_goals: [],
      }).success,
    ).toBe(false);
  });

  it("rejects duplicates and invalid matching ranges", () => {
    expect(
      familySettingsSchema.safeParse({
        ...validFamilySettings,
        languages: [
          validFamilySettings.languages[0],
          validFamilySettings.languages[0],
        ],
      }).success,
    ).toBe(false);
    expect(
      familySettingsSchema.safeParse({
        ...validFamilySettings,
        preferences: {
          ...validFamilySettings.preferences,
          min_child_age: 15,
          max_child_age: 4,
        },
      }).success,
    ).toBe(false);
  });
});
