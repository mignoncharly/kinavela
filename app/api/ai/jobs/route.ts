import { NextResponse } from "next/server";

import { getPromptVersion } from "@/lib/ai/prompts";
import { aiErrorCode } from "@/lib/ai/logging";
import { assertAiProviderReady } from "@/lib/ai/provider";

import { assertSameOrigin } from "@/lib/security/request";
import { createClient } from "@/lib/supabase/server";
import { aiActionSchema } from "@/lib/validation/ai";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = aiActionSchema.parse(await request.json());
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false }, { status: 401 });
    if (input.action === "create") {
      try {
        assertAiProviderReady();
      } catch (error) {
        return NextResponse.json(
          { ok: false, errorCode: aiErrorCode(error) },
          { status: 503 },
        );
      }
      const { data, error } = await supabase.rpc("create_ai_job", {
        p_feature: input.feature,
        p_subject_type: input.subject_type,
        p_subject_id: input.subject_id ?? null,
        p_locale: input.locale,
        p_prompt_version: getPromptVersion(input.feature),
        p_input_context: input.context,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return NextResponse.json({ ok: true, job: row });
    }
    const { data, error } = await supabase.rpc("review_ai_job", {
      p_job_id: input.job_id,
      p_moderation_status: input.moderation_status,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true, reviewed: data });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
