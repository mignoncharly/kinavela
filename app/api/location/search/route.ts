import { NextResponse } from "next/server";

import { searchCities } from "@/lib/geo/geocoder";
import { clientAddressFingerprint } from "@/lib/security/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { citySearchSchema } from "@/lib/validation/discovery";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false }, { status: 401 });
    const url = new URL(request.url);
    const input = citySearchSchema.parse({
      query: url.searchParams.get("query"),
      country: url.searchParams.get("country"),
      locale: url.searchParams.get("locale"),
    });
    const admin = createAdminClient();
    const { data: allowed, error } = await admin.rpc(
      "consume_geocoding_rate_limit",
      {
        p_identifier_hash: clientAddressFingerprint(request),
        p_max_attempts: 10,
        p_window_seconds: 60,
      },
    );
    if (error) throw error;
    if (!allowed)
      return NextResponse.json(
        { ok: false, error: "rate_limited" },
        { status: 429 },
      );
    const results = await searchCities(input);
    return NextResponse.json({ ok: true, results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    const status = message === "provider_rate_limited" ? 429 : 400;
    return NextResponse.json(
      { ok: false, error: status === 429 ? "try_again" : "invalid_request" },
      { status },
    );
  }
}
