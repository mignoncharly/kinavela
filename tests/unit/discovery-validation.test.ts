import { describe, expect, it } from "vitest";

import {
  citySearchSchema,
  discoveryBlockSchema,
  discoverySearchSchema,
  locationUpdateSchema,
} from "@/lib/validation/discovery";

describe("location and discovery validation", () => {
  it("accepts city names, postcodes and bounded discovery filters", () => {
    expect(
      citySearchSchema.safeParse({
        query: "Schrobenhausen",
        country: "DE",
        locale: "de",
      }).success,
    ).toBe(true);
    expect(
      citySearchSchema.safeParse({
        query: "85123",
        country: "DE",
        locale: "en",
      }).success,
    ).toBe(true);
    expect(
      discoverySearchSchema.safeParse({
        radius: "40",
        country: "DE",
        minAge: "3",
        maxAge: "8",
        weekday: "6",
        period: "afternoon",
      }).success,
    ).toBe(true);
  });

  it("rejects street-like searches and invalid boundaries", () => {
    expect(
      citySearchSchema.safeParse({
        query: "Main Street 12, Berlin",
        country: "DE",
        locale: "de",
      }).success,
    ).toBe(false);
    expect(
      discoverySearchSchema.safeParse({ minAge: "12", maxAge: "4" }).success,
    ).toBe(false);
    expect(discoverySearchSchema.safeParse({ weekday: "6" }).success).toBe(
      false,
    );
    expect(
      locationUpdateSchema.safeParse({ location_place_id: "x", radius_km: 200 })
        .success,
    ).toBe(false);
  });

  it("requires a UUID and explicit state for blocking", () => {
    expect(
      discoveryBlockSchema.safeParse({
        family_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        blocked: true,
      }).success,
    ).toBe(true);
    expect(
      discoveryBlockSchema.safeParse({ family_id: "family", blocked: true })
        .success,
    ).toBe(false);
  });
});
