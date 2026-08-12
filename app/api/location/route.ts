import { NextResponse } from "next/server";

import { assertSameOrigin } from "@/lib/security/request";
import { createClient } from "@/lib/supabase/server";
import { locationUpdateSchema } from "@/lib/validation/discovery";

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const input = locationUpdateSchema.parse(await request.json());
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false }, { status: 401 });
    const { error } = await supabase.rpc("set_family_location", {
      p_provider_place_id: input.location_place_id,
      p_radius_km: input.radius_km,
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
