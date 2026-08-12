import { NextResponse } from "next/server";

import { assertSameOrigin } from "@/lib/security/request";
import { createClient } from "@/lib/supabase/server";
import { discoveryBlockSchema } from "@/lib/validation/discovery";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = discoveryBlockSchema.parse(await request.json());
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false }, { status: 401 });
    const { error } = await supabase.rpc("set_discovery_block", {
      p_target_family_id: input.family_id,
      p_blocked: input.blocked,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_request" },
      { status: 400 },
    );
  }
}
