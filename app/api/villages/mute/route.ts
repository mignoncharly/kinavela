import { NextResponse } from "next/server";

import { assertSameOrigin } from "@/lib/security/request";
import { createClient } from "@/lib/supabase/server";
import { villageMuteSchema } from "@/lib/validation/villages";

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const input = villageMuteSchema.parse(await request.json());
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false }, { status: 401 });
    const { error } = await supabase.rpc("set_village_conversation_muted", {
      p_village_id: input.village_id,
      p_muted: input.muted,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
