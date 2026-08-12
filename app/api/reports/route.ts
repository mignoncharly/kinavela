import { NextResponse } from "next/server";

import { assertSameOrigin } from "@/lib/security/request";
import { createClient } from "@/lib/supabase/server";
import { reportSchema } from "@/lib/validation/messaging";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = reportSchema.parse(await request.json());
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false }, { status: 401 });
    const { data, error } = await supabase.rpc("submit_report", {
      p_target_type: input.target_type,
      p_target_id: input.target_id,
      p_reason: input.reason,
      p_details: input.details || null,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true, reportId: data });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
