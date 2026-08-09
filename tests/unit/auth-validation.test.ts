import { describe, expect, it } from "vitest";

import { passwordSchema, signupSchema } from "@/lib/validation/auth";

describe("authentication validation", () => {
  it("requires a strong production password", () => {
    expect(passwordSchema.safeParse("short").success).toBe(false);
    expect(passwordSchema.safeParse("LongSecurePassword9").success).toBe(true);
  });

  it("requires explicit legal consent", () => {
    expect(
      signupSchema.safeParse({
        email: "family@example.com",
        password: "LongSecurePassword9",
        displayName: "Nkom Family",
        locale: "en",
        acceptTerms: false,
        acceptPrivacy: true,
      }).success,
    ).toBe(false);
  });
});
