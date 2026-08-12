import { describe, expect, it } from "vitest";

import { adminActionSchema, adminReportSchema } from "@/lib/validation/admin";

const report = {
  report_id: "a0000000-0000-4000-8000-000000000001",
  target_type: "message" as const,
  target_family_id: "a1000000-0000-4000-8000-000000000001",
  target_message_id: "a2000000-0000-4000-8000-000000000001",
  target_village_id: null,
  reason: "harassment",
  details: "Please review this report.",
  status: "open" as const,
  reporter_profile_id: "a3000000-0000-4000-8000-000000000001",
  created_at: "2026-08-11T08:00:00+00:00",
  updated_at: "2026-08-11T08:00:00+00:00",
};

describe("Admin and moderation contracts", () => {
  it("accepts safe report projections and rejects identity internals", () => {
    expect(adminReportSchema.safeParse(report).success).toBe(true);
    expect(
      adminReportSchema.safeParse({
        ...report,
        auth_user_id: report.reporter_profile_id,
      }).success,
    ).toBe(false);
  });

  it("allows only explicit operational actions", () => {
    expect(
      adminActionSchema.safeParse({
        action: "set_report_status",
        report_id: report.report_id,
        status: "resolved",
      }).success,
    ).toBe(true);
    expect(
      adminActionSchema.safeParse({
        action: "suspend_profile",
        profile_id: report.reporter_profile_id,
        reason: "Repeated harassment reports",
      }).success,
    ).toBe(true);
    expect(
      adminActionSchema.safeParse({
        action: "grant_admin_role",
        profile_id: report.reporter_profile_id,
      }).success,
    ).toBe(false);
  });
});
