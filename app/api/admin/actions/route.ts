import { NextResponse } from "next/server";

import { assertSameOrigin } from "@/lib/security/request";
import { createClient } from "@/lib/supabase/server";
import { adminActionSchema } from "@/lib/validation/admin";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = adminActionSchema.parse(await request.json());
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false }, { status: 401 });

    let error;
    if (input.action === "set_report_status") {
      ({ error } = await supabase.rpc("admin_set_report_status", {
        p_report_id: input.report_id,
        p_status: input.status,
      }));
    } else if (input.action === "suspend_profile") {
      ({ error } = await supabase.rpc("admin_suspend_profile", {
        p_profile_id: input.profile_id,
        p_reason: input.reason ?? null,
      }));
    } else if (input.action === "restore_profile") {
      ({ error } = await supabase.rpc("admin_restore_profile", {
        p_profile_id: input.profile_id,
      }));
    } else {
      ({ error } = await supabase.rpc("admin_set_feature_flag", {
        p_flag_key: input.flag_key,
        p_enabled: input.enabled,
        p_rollout_percent: input.rollout_percent,
        p_description: input.description ?? "",
      }));
    }
    if (error) return NextResponse.json({ ok: false }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
