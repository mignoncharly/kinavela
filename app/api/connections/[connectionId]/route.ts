import { NextResponse } from "next/server";

import { assertSameOrigin } from "@/lib/security/request";

import { createClient } from "@/lib/supabase/server";
import {
  connectionIdSchema,
  connectionResponseSchema,
} from "@/lib/validation/connections";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ connectionId: string }> },
) {
  try {
    assertSameOrigin(request);
    const { connectionId } = await params;
    const id = connectionIdSchema.parse(connectionId);
    const input = connectionResponseSchema.parse(await request.json());
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false }, { status: 401 });
    const { error } = await supabase.rpc("respond_family_connection", {
      p_connection_id: id,
      p_accept: input.accept,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
