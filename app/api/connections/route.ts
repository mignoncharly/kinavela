import { NextResponse } from "next/server";

import { assertSameOrigin } from "@/lib/security/request";

import { createClient } from "@/lib/supabase/server";
import { connectionRequestSchema } from "@/lib/validation/connections";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = connectionRequestSchema.parse(await request.json());
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false }, { status: 401 });
    const { data, error } = await supabase.rpc("request_family_connection", {
      p_target_family_id: input.family_id,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true, connectionId: data });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
