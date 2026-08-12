import { describe, expect, it } from "vitest";

import {
  consentSchema,
  personalDataExportSchema,
  productEmailConsentSchema,
} from "@/lib/validation/privacy";

describe("privacy validation", () => {
  it("accepts only the safe export status projection", () => {
    const parsed = personalDataExportSchema.safeParse({
      export_id: "00000000-0000-4000-8000-000000000001",
      status: "ready",
      requested_at: "2026-08-11T00:00:00.000Z",
      completed_at: "2026-08-11T00:01:00.000Z",
      expires_at: "2026-08-18T00:01:00.000Z",
    });
    expect(parsed.success).toBe(true);
    expect(
      personalDataExportSchema.safeParse({
        ...(parsed.success && parsed.data),
        file_path: "private.json",
      }).success,
    ).toBe(false);
  });

  it("rejects auth identifiers from consent data", () => {
    expect(
      consentSchema.safeParse({
        consent_type: "product_email",
        policy_version: "v1",
        granted_at: "2026-08-11T00:00:00.000Z",
        revoked_at: null,
        auth_user_id: "00000000-0000-4000-8000-000000000001",
      }).success,
    ).toBe(false);
  });

  it("requires a boolean consent choice", () => {
    expect(
      productEmailConsentSchema.safeParse({ product_email: true }).success,
    ).toBe(true);
    expect(
      productEmailConsentSchema.safeParse({ product_email: "yes" }).success,
    ).toBe(false);
  });
});
