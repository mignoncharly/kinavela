import { NextResponse } from "next/server";

import { assertSameOrigin } from "@/lib/security/request";
import { createClient } from "@/lib/supabase/server";
import { updatePasswordSchema } from "@/lib/validation/auth";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = updatePasswordSchema.parse(await request.json());
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json(
        { ok: false, error: "not_authenticated" },
        { status: 401 },
      );
    const { error } = await supabase.auth.updateUser({
      password: input.password,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    const status = message === "invalid_origin" ? 403 : 400;
    return NextResponse.json(
      { ok: false, error: "invalid_request" },
      { status },
    );
  }
}
