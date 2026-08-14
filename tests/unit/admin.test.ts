import { describe, expect, it } from "vitest";

import {
  adminActionSchema,
  adminProductMetricSchema,
  adminRegionalOutreachSchema,
  adminReportSchema,
} from "@/lib/validation/admin";

const report = {
  report_id: "a0000000-0000-4000-8000-000000000001",
  target_type: "message" as const,
  target_family_id: "a1000000-0000-4000-8000-000000000001",
  target_message_id: "a2000000-0000-4000-8000-000000000001",
  target_village_id: null,
  target_event_id: null,
  target_event_title: null,
  target_support_post_id: null,
  target_support_post_title: null,
  target_support_reply_id: null,
  reason: "harassment",
  details: "Please review this report.",
  status: "open" as const,
  severity: "medium" as const,
  urgent_child_safety: false,
  assigned_to_profile_id: null,
  response_due_at: "2026-08-14T08:00:00+00:00",
  resolution_notes: null,
  reporter_profile_id: "a3000000-0000-4000-8000-000000000001",
  action_count: 1,
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
        action: "manage_report",
        report_id: report.report_id,
        operation: "resolve",
        note: "Reviewed and resolved.",
      }).success,
    ).toBe(true);
    expect(
      adminActionSchema.safeParse({
        action: "manage_report",
        report_id: report.report_id,
        operation: "resolve",
      }).success,
    ).toBe(false);
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

describe("Phase 14 admin analytics contracts", () => {
  it("uses product and outreach language without admission state", () => {
    expect(
      adminProductMetricSchema.safeParse({
        metric_key: "onboarding_completion",
        metric_value: 75,
        denominator: 20,
        as_of: "2026-08-13T12:00:00+00:00",
      }).success,
    ).toBe(true);
    expect(
      adminRegionalOutreachSchema.safeParse({
        country_code: "DE",
        city: "Aresing",
        historical_interest_count: 3,
        family_count: 5,
      }).success,
    ).toBe(true);
    expect(
      adminRegionalOutreachSchema.safeParse({
        country_code: "DE",
        city: "Aresing",
        historical_interest_count: 3,
        family_count: 5,
        rollout_status: "paused",
      }).success,
    ).toBe(false);
  });
});
