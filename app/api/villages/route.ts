import { NextResponse } from "next/server";

import { assertSameOrigin } from "@/lib/security/request";
import { createClient } from "@/lib/supabase/server";
import { villageCreateSchema } from "@/lib/validation/villages";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = villageCreateSchema.parse(await request.json());
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false }, { status: 401 });
    const { data, error } = await supabase.rpc("create_village", {
      p_name: input.name,
      p_description: input.description,
      p_village_type: input.village_type,
      p_country_focus_id: input.country_focus_id ?? null,
      p_radius_km: input.radius_km,
      p_visibility: input.visibility,
      p_member_limit: input.member_limit,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true, villageId: data });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
