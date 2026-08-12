import { NextResponse } from "next/server";

import { assertSameOrigin } from "@/lib/security/request";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const body = (await request.json()) as { notification_id?: string };
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || typeof body.notification_id !== "string")
      return NextResponse.json({ ok: false }, { status: 401 });
    const { error } = await supabase.rpc("mark_notification_event_read", {
      p_notification_id: body.notification_id,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
