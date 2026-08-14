import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { errorMessage } from "@/lib/api/error-message";
import { assertSameOrigin } from "@/lib/security/request";
import { createClient } from "@/lib/supabase/server";
import { familySettingsSchema } from "@/lib/validation/family-settings";

const knownErrors = new Set([
  "owner_required",
  "child_has_cultural_history",
  "child_not_found",
  "invalid_family_settings",
  "invalid_family_profile",
  "invalid_children",
  "invalid_cultures",
  "invalid_languages",
  "invalid_interests",
  "invalid_availability",
  "invalid_preservation_goals",
  "invalid_age_range",
  "invalid_matching_priorities",
  "duplicate_family_settings",
  "invalid_child",
  "invalid_culture",
  "invalid_language",
]);

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
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

    const payload = familySettingsSchema.parse(await request.json());
    const { data, error } = await supabase.rpc("update_my_family_settings", {
      p_payload: payload,
    });
    if (error) throw error;

    return NextResponse.json({ ok: true, familyId: data });
  } catch (error) {
    const message = errorMessage(error);
    if (message === "invalid_origin") {
      return NextResponse.json(
        { ok: false, error: "validation_failed" },
        { status: 403 },
      );
    }
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return NextResponse.json(
        { ok: false, error: "validation_failed" },
        { status: 400 },
      );
    }
    const code = [...knownErrors].find((item) => message.includes(item));
    if (code) {
      return NextResponse.json(
        { ok: false, error: code },
        { status: code === "owner_required" ? 403 : 400 },
      );
    }

    console.error("Family settings update failed", { message });
    return NextResponse.json(
      { ok: false, error: "validation_failed" },
      { status: 400 },
    );
  }
}
