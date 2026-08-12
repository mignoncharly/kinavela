import { NextResponse } from "next/server";

import { assertSameOrigin } from "@/lib/security/request";
import { createClient } from "@/lib/supabase/server";
import { villageMembershipActionSchema } from "@/lib/validation/villages";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = villageMembershipActionSchema.parse(await request.json());
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false }, { status: 401 });
    let result;
    switch (input.action) {
      case "request":
        result = await supabase.rpc("request_village_membership", {
          p_village_id: input.village_id,
        });
        break;
      case "invite":
        result = await supabase.rpc("invite_family_to_village", {
          p_village_id: input.village_id,
          p_family_id: input.family_id,
        });
        break;
      case "respond_invitation":
        result = await supabase.rpc("respond_village_invitation", {
          p_village_id: input.village_id,
          p_accept: input.accept,
        });
        break;
      case "respond_request":
        result = await supabase.rpc("respond_village_join_request", {
          p_village_id: input.village_id,
          p_family_id: input.family_id,
          p_accept: input.accept,
        });
        break;
      case "set_role":
        result = await supabase.rpc("set_village_member_role", {
          p_village_id: input.village_id,
          p_family_id: input.family_id,
          p_role: input.role,
        });
        break;
      case "leave":
        result = await supabase.rpc("leave_village", {
          p_village_id: input.village_id,
        });
        break;
      case "remove":
        result = await supabase.rpc("remove_village_member", {
          p_village_id: input.village_id,
          p_family_id: input.family_id,
        });
        break;
    }
    if (result.error) throw result.error;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
