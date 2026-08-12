import { NextResponse } from "next/server";

import { assertSameOrigin } from "@/lib/security/request";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  context: { params: Promise<{ connectionId: string }> },
) {
  try {
    assertSameOrigin(request);
    const { connectionId } = await context.params;
    if (!/^[0-9a-f-]{36}$/i.test(connectionId))
      return NextResponse.json({ ok: false }, { status: 400 });
    const supabase = await createClient();
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return NextResponse.json({ ok: false }, { status: 401 });
    const { error } = await supabase.rpc("record_real_life_meeting", {
      p_connection_id: connectionId,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
