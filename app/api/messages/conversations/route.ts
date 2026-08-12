import { NextResponse } from "next/server";

import { assertSameOrigin } from "@/lib/security/request";
import { createClient } from "@/lib/supabase/server";
import { conversationCreateSchema } from "@/lib/validation/messaging";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = conversationCreateSchema.parse(await request.json());
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false }, { status: 401 });
    const { data, error } = await supabase.rpc(
      "get_or_create_family_conversation",
      { p_other_family_id: input.family_id },
    );
    if (error) throw error;
    return NextResponse.json({ ok: true, conversationId: data });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
