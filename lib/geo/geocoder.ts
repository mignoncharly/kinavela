import "server-only";

import { createHash } from "node:crypto";
import { z } from "zod";

import { serverEnv } from "@/lib/env.server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CitySearchInput } from "@/lib/validation/discovery";

const providerResultSchema = z.array(
  z.object({
    place_id: z.union([z.string(), z.number()]),
    lat: z.string(),
    lon: z.string(),
    display_name: z.string(),
    address: z
      .object({
        city: z.string().optional(),
        town: z.string().optional(),
        village: z.string().optional(),
        municipality: z.string().optional(),
        county: z.string().optional(),
        state: z.string().optional(),
        country_code: z.string().optional(),
      })
      .passthrough(),
  }),
);

export type CityResult = {
  placeId: string;
  city: string;
  area: string | null;
  countryCode: string;
};

function queryHash(input: CitySearchInput) {
  return createHash("sha256")
    .update(`${input.country}|${input.query.trim().toLocaleLowerCase("en")}`)
    .digest("hex");
}

function publicResult(row: {
  provider_place_id: string;
  display_city: string;
  display_area: string | null;
  country_code: string;
}): CityResult {
  return {
    placeId: row.provider_place_id,
    city: row.display_city,
    area: row.display_area,
    countryCode: row.country_code,
  };
}

export async function searchCities(input: CitySearchInput) {
  const admin = createAdminClient();
  const hash = queryHash(input);
  const { data: cached, error: cacheError } = await admin
    .from("geocoding_cache")
    .select("provider_place_id,display_city,display_area,country_code")
    .eq("query_hash", hash)
    .gt("expires_at", new Date().toISOString())
    .limit(5);
  if (cacheError) throw cacheError;
  if (cached.length > 0) return cached.map(publicResult);

  const { data: claimed, error: claimError } = await admin.rpc(
    "claim_geocoding_provider_slot",
  );
  if (claimError) throw claimError;
  if (!claimed) throw new Error("provider_rate_limited");

  const url = new URL("search", `${serverEnv.GEOCODING_BASE_URL}/`);
  const isPostcode =
    /^[A-Za-z0-9 -]{3,10}$/.test(input.query) && /\d/.test(input.query);
  url.searchParams.set(isPostcode ? "postalcode" : "city", input.query);
  url.searchParams.set("countrycodes", input.country.toLowerCase());
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "5");
  url.searchParams.set("accept-language", input.locale);

  const response = await fetch(url, {
    cache: "no-store",
    headers: { "User-Agent": `Kinavela/0.2 (${serverEnv.EMAIL_REPLY_TO})` },
  });
  if (!response.ok) throw new Error("geocoding_unavailable");
  const rawResults = providerResultSchema.parse(await response.json());
  const rows = rawResults.flatMap((result) => {
    const latitude = Number(result.lat);
    const longitude = Number(result.lon);
    const countryCode = result.address.country_code?.toUpperCase();
    const city =
      result.address.city ??
      result.address.town ??
      result.address.village ??
      result.address.municipality ??
      result.address.county ??
      result.display_name.split(",")[0]?.trim();
    if (
      !city ||
      city.length < 2 ||
      !countryCode ||
      countryCode !== input.country ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 ||
      Math.abs(longitude) > 180
    ) {
      return [];
    }
    return [
      {
        query_hash: hash,
        provider_place_id: `nominatim:${String(result.place_id)}`,
        display_city: city.slice(0, 120),
        display_area:
          (result.address.state ?? result.address.county)?.slice(0, 120) ??
          null,
        country_code: countryCode,
        location: `POINT(${longitude} ${latitude})`,
        created_at: new Date().toISOString(),
        expires_at: new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000,
        ).toISOString(),
      },
    ];
  });
  if (rows.length === 0) return [];
  const { data: stored, error: storeError } = await admin
    .from("geocoding_cache")
    .upsert(rows, { onConflict: "provider_place_id" })
    .select("provider_place_id,display_city,display_area,country_code");
  if (storeError) throw storeError;
  return stored.map(publicResult);
}
