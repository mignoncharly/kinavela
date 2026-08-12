import { NextResponse } from "next/server";

import { assertSameOrigin } from "@/lib/security/request";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = (await request.json()) as {
      event?: unknown;
      metadata?: unknown;
    };
    if (
      typeof body.event !== "string" ||
      !["app_session_started", "discovery_opened"].includes(body.event)
    )
      return NextResponse.json({ ok: false }, { status: 400 });
    const supabase = await createClient();
    const { data: user } = await supabase.auth.getUser();
    if (!user.user)
      return new NextResponse(null, {
        status: 204,
        headers: { "Cache-Control": "no-store" },
      });
    const { error } = await supabase.rpc("track_product_event", {
      p_event_name: body.event,
      p_metadata: body.metadata ?? {},
    });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
