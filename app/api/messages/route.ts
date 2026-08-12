import { NextResponse } from "next/server";

import { assertSameOrigin } from "@/lib/security/request";
import { createClient } from "@/lib/supabase/server";
import { messageSendSchema } from "@/lib/validation/messaging";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = messageSendSchema.parse(await request.json());
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false }, { status: 401 });
    const { data, error } = await supabase.rpc("send_family_message", {
      p_conversation_id: input.conversation_id,
      p_body: input.body,
      p_reply_to: input.reply_to ?? null,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true, messageId: data });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
