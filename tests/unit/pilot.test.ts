import { describe, expect, it } from "vitest";

import {
  adminPilotMetricSchema,
  adminRegionalDensitySchema,
} from "@/lib/validation/admin";

describe("pilot operations projections", () => {
  it("accepts a bounded metric row", () => {
    expect(
      adminPilotMetricSchema.safeParse({
        metric_key: "retention_30_day",
        metric_value: 42.5,
        denominator: 20,
        as_of: "2026-08-11T00:00:00.000Z",
      }).success,
    ).toBe(true);
  });

  it("rejects density rows from another country or unknown rollout state", () => {
    expect(
      adminRegionalDensitySchema.safeParse({
        country_code: "US",
        city: "Berlin",
        waiting_count: 3,
        family_count: 2,
        threshold: 10,
        rollout_status: "open",
      }).success,
    ).toBe(false);
    expect(
      adminRegionalDensitySchema.safeParse({
        country_code: "DE",
        city: "Berlin",
        waiting_count: 3,
        family_count: 2,
        threshold: 10,
        rollout_status: "launch",
      }).success,
    ).toBe(false);
  });
});
