import { NextResponse } from "next/server";
import { assertSameOrigin } from "@/lib/security/request";
import { createClient } from "@/lib/supabase/server";
import { eventMessageSchema } from "@/lib/validation/playdates";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = eventMessageSchema.parse(await request.json());
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false }, { status: 401 });
    const { data, error } = await supabase.rpc("send_event_message", {
      p_event_id: input.event_id,
      p_body: input.body,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true, messageId: data });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
