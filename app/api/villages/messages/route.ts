import { NextResponse } from "next/server";

import { assertSameOrigin } from "@/lib/security/request";
import { createClient } from "@/lib/supabase/server";
import { villageMessageSchema } from "@/lib/validation/villages";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = villageMessageSchema.parse(await request.json());
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false }, { status: 401 });
    const { data, error } = await supabase.rpc("send_village_message", {
      p_village_id: input.village_id,
      p_body: input.body,
      p_reply_to: input.reply_to ?? null,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true, messageId: data });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
