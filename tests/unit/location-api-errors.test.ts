import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET as searchLocation } from "@/app/api/location/search/route";
import { PATCH as updateLocation } from "@/app/api/location/route";
import { POST as completeOnboarding } from "@/app/api/onboarding/route";
import { searchCities } from "@/lib/geo/geocoder";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/security/request", () => ({
  assertSameOrigin: vi.fn(),
  clientAddressFingerprint: vi.fn(() => "test-fingerprint"),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/geo/geocoder", () => ({ searchCities: vi.fn() }));

const user = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  email_confirmed_at: "2026-08-13T00:00:00.000Z",
};

const onboardingPayload = {
  display_name: "Aresing Parent",
  preferred_language: "en",
  timezone: "Europe/Berlin",
  family: {
    name: "Aresing Family",
    country_of_residence: "DE",
    city: "Aresing",
    location_place_id: "nominatim:aresing",
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
};

function authenticatedClient(errorMessage: string | null = null) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    rpc: vi.fn().mockResolvedValue({
      data: errorMessage ? null : "family-id",
      error: errorMessage ? { message: errorMessage } : null,
    }),
  };
}

describe("Germany-wide location API errors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ["invalid_location", 400],
    ["germany_location_required", 400],
  ])("returns %s from onboarding", async (errorCode, status) => {
    vi.mocked(createClient).mockResolvedValue(
      authenticatedClient(errorCode) as never,
    );
    const response = await completeOnboarding(
      new Request("https://kinavela.test/api/onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(onboardingPayload),
      }),
    );

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toMatchObject({ error: errorCode });
  });

  it("returns a clear non-German error from a location change", async () => {
    vi.mocked(createClient).mockResolvedValue(
      authenticatedClient("germany_location_required") as never,
    );
    const response = await updateLocation(
      new Request("https://kinavela.test/api/location", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          location_place_id: "nominatim:paris",
          radius_km: 40,
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "germany_location_required",
    });
  });

  it("distinguishes a temporary geocoding failure", async () => {
    vi.mocked(createClient).mockResolvedValue(authenticatedClient() as never);
    vi.mocked(createAdminClient).mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
    } as never);
    vi.mocked(searchCities).mockRejectedValue(
      new Error("geocoding_unavailable"),
    );

    const response = await searchLocation(
      new Request(
        "https://kinavela.test/api/location/search?query=85123&country=DE&locale=de",
      ),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: "geocoding_unavailable",
    });
  });
});
