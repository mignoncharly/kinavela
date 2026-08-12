import { NextResponse } from "next/server";

import { assertSameOrigin } from "@/lib/security/request";
import { createClient } from "@/lib/supabase/server";
import {
  villageReportResolutionSchema,
  villageReportSchema,
} from "@/lib/validation/villages";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = villageReportSchema.parse(await request.json());
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false }, { status: 401 });
    const { data, error } = await supabase.rpc("submit_village_report", {
      p_village_id: input.village_id,
      p_message_id: input.message_id ?? null,
      p_reason: input.reason,
      p_details: input.details || null,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true, reportId: data });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const input = villageReportResolutionSchema.parse(await request.json());
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false }, { status: 401 });
    const { error } = await supabase.rpc("resolve_village_report", {
      p_report_id: input.report_id,
      p_resolution: input.resolution,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
