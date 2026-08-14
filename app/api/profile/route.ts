import { NextResponse } from "next/server";
import { z } from "zod";

import { locales } from "@/lib/i18n/config";
import { assertSameOrigin } from "@/lib/security/request";
import { createClient } from "@/lib/supabase/server";

const schema = z
  .object({
    display_name: z.string().trim().min(2).max(80),
    preferred_language: z.enum(locales),
  })
  .strict();

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const input = schema.parse(await request.json());
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false }, { status: 401 });
    const { error } = await supabase
      .from("profiles")
      .update(input)
      .eq("auth_user_id", user.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_request" },
      { status: 400 },
    );
  }
}
