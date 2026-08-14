import { describe, expect, it } from "vitest";

import {
  adminProductMetricSchema,
  adminRegionalOutreachSchema,
} from "@/lib/validation/admin";

describe("Germany-wide operations projections", () => {
  it("accepts a bounded product metric row", () => {
    expect(
      adminProductMetricSchema.safeParse({
        metric_key: "retention_30_day",
        metric_value: 42.5,
        denominator: 20,
        as_of: "2026-08-11T00:00:00.000Z",
      }).success,
    ).toBe(true);
  });

  it("accepts only non-blocking German outreach rows", () => {
    expect(
      adminRegionalOutreachSchema.safeParse({
        country_code: "DE",
        city: "Aresing",
        historical_interest_count: 3,
        family_count: 2,
      }).success,
    ).toBe(true);
    expect(
      adminRegionalOutreachSchema.safeParse({
        country_code: "US",
        city: "Berlin",
        historical_interest_count: 3,
        family_count: 2,
      }).success,
    ).toBe(false);
    expect(
      adminRegionalOutreachSchema.safeParse({
        country_code: "DE",
        city: "Berlin",
        historical_interest_count: 3,
        family_count: 2,
        rollout_status: "paused",
      }).success,
    ).toBe(false);
  });
});
