import { NextResponse } from "next/server";

import { assertSameOrigin } from "@/lib/security/request";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return NextResponse.json({ ok: false }, { status: 401 });
  const { data, error } = await supabase.rpc("list_my_pilot_waitlist");
  if (error) return NextResponse.json({ ok: false }, { status: 503 });
  return NextResponse.json({ ok: true, entries: data ?? [] });
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = (await request.json()) as {
      country_code?: unknown;
      city?: unknown;
      culture_focus?: unknown;
    };
    if (
      typeof body.country_code !== "string" ||
      typeof body.city !== "string" ||
      body.city.trim().length < 2 ||
      body.city.trim().length > 120
    )
      return NextResponse.json({ ok: false }, { status: 400 });
    const supabase = await createClient();
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return NextResponse.json({ ok: false }, { status: 401 });
    const { data, error } = await supabase.rpc("join_pilot_waitlist", {
      p_country_code: body.country_code,
      p_city: body.city,
      p_culture_focus:
        typeof body.culture_focus === "string"
          ? body.culture_focus
          : "cameroon",
    });
    if (error) throw error;
    return NextResponse.json({ ok: true, waitlistId: data });
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_pilot_region" },
      { status: 400 },
    );
  }
}
