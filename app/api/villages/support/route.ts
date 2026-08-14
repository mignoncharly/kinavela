import { NextResponse } from "next/server";

import { assertSameOrigin } from "@/lib/security/request";
import { createClient } from "@/lib/supabase/server";
import { supportActionSchema } from "@/lib/validation/support";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = supportActionSchema.parse(await request.json());
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false }, { status: 401 });

    let result;
    if (input.action === "create") {
      result = await supabase.rpc("create_village_support_post", {
        p_village_id: input.village_id,
        p_content_type: input.content_type,
        p_category: input.category,
        p_title: input.title,
        p_body: input.body,
        p_privacy_confirmed: input.privacy_confirmed,
      });
    } else if (input.action === "reply") {
      result = await supabase.rpc("reply_to_village_support_post", {
        p_post_id: input.post_id,
        p_body: input.body,
        p_privacy_confirmed: input.privacy_confirmed,
      });
    } else if (input.action === "close") {
      result = await supabase.rpc("close_village_support_post", {
        p_post_id: input.post_id,
      });
    } else if (input.action === "report") {
      result = await supabase.rpc("submit_village_support_report", {
        p_post_id: input.post_id,
        p_reply_id: input.reply_id ?? null,
        p_reason: input.reason,
        p_details: input.details || null,
      });
    } else {
      result = await supabase.rpc("moderate_village_support_content", {
        p_post_id: input.post_id ?? null,
        p_reply_id: input.reply_id ?? null,
        p_reason: input.reason,
      });
    }
    if (result.error) return NextResponse.json({ ok: false }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
