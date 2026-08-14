import { NextResponse } from "next/server";

import { assertSameOrigin } from "@/lib/security/request";
import { createClient } from "@/lib/supabase/server";
import { trustActionSchema } from "@/lib/validation/trust";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = trustActionSchema.parse(await request.json());
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false }, { status: 401 });

    let result;
    switch (input.action) {
      case "sync_auth":
        result = await supabase.rpc("sync_my_auth_verifications");
        break;
      case "acknowledge_meeting_safety":
        result = await supabase.rpc("acknowledge_meeting_safety", {
          p_context: input.context,
        });
        break;
      case "request_community_verification":
        result = await supabase.rpc("request_community_verification", {
          p_village_id: input.village_id,
        });
        break;
      case "endorse_community_verification":
        result = await supabase.rpc("endorse_community_verification", {
          p_request_id: input.request_id,
        });
        break;
    }
    if (result.error) return NextResponse.json({ ok: false }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
