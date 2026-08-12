import { NextResponse } from "next/server";

import { assertSameOrigin } from "@/lib/security/request";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = (await request.json()) as { city?: unknown; status?: unknown };
    if (
      typeof body.city !== "string" ||
      !["waitlist", "open", "paused"].includes(String(body.status))
    )
      return NextResponse.json({ ok: false }, { status: 400 });
    const supabase = await createClient();
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return NextResponse.json({ ok: false }, { status: 401 });
    const { error } = await supabase.rpc("admin_set_pilot_region_status", {
      p_country_code: "DE",
      p_city: body.city,
      p_status: body.status,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
