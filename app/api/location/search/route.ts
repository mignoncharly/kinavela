import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { errorMessage } from "@/lib/api/error-message";
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
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "not_authenticated" },
        { status: 401 },
      );
    }

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
    if (!allowed) {
      return NextResponse.json(
        { ok: false, error: "geocoding_unavailable" },
        { status: 429 },
      );
    }

    const results = await searchCities(input);
    return NextResponse.json({ ok: true, results });
  } catch (error) {
    const message = errorMessage(error);
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return NextResponse.json(
        { ok: false, error: "validation_failed" },
        { status: 400 },
      );
    }
    if (
      message === "provider_rate_limited" ||
      message === "geocoding_unavailable"
    ) {
      return NextResponse.json(
        { ok: false, error: "geocoding_unavailable" },
        { status: message === "provider_rate_limited" ? 429 : 503 },
      );
    }
    console.error("Location search failed", { message });
    return NextResponse.json(
      { ok: false, error: "geocoding_unavailable" },
      { status: 503 },
    );
  }
}
