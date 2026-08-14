import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { errorMessage } from "@/lib/api/error-message";
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
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "not_authenticated" },
        { status: 401 },
      );
    }

    const { error } = await supabase.rpc("set_family_location", {
      p_provider_place_id: input.location_place_id,
      p_radius_km: input.radius_km,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = errorMessage(error);
    if (message === "invalid_origin") {
      return NextResponse.json(
        { ok: false, error: "validation_failed" },
        { status: 403 },
      );
    }
    if (message.includes("germany_location_required")) {
      return NextResponse.json(
        { ok: false, error: "germany_location_required" },
        { status: 400 },
      );
    }
    if (message.includes("invalid_location")) {
      return NextResponse.json(
        { ok: false, error: "invalid_location" },
        { status: 400 },
      );
    }
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return NextResponse.json(
        { ok: false, error: "validation_failed" },
        { status: 400 },
      );
    }
    console.error("Location update failed", { message });
    return NextResponse.json(
      { ok: false, error: "validation_failed" },
      { status: 400 },
    );
  }
}
