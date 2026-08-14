import { NextResponse } from "next/server";
import { assertAiProviderReady } from "@/lib/ai/provider";

import { assertSameOrigin } from "@/lib/security/request";
import { createClient } from "@/lib/supabase/server";
import { storyActionSchema } from "@/lib/validation/stories";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = storyActionSchema.parse(await request.json());
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false }, { status: 401 });
    if (input.action === "create_request") {
      assertAiProviderReady();
      const { data, error } = await supabase.rpc("create_story_request", {
        p_child_id: input.child_id,
        p_question: input.question,
        p_requested_translation_language:
          input.requested_translation_language ?? null,
        p_request_adaptation: input.request_adaptation,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return NextResponse.json({ ok: true, request: row });
    }
    if (input.action === "revoke_request") {
      const { data, error } = await supabase.rpc("revoke_story_request", {
        p_request_id: input.request_id,
      });
      if (error) throw error;
      return NextResponse.json({ ok: true, revoked: data });
    }
    if (input.action === "review") {
      const { data, error } = await supabase.rpc("review_family_story", {
        p_story_id: input.story_id,
        p_approval: input.approval,
        p_adapted_story: input.adapted_story ?? null,
      });
      if (error) throw error;
      return NextResponse.json({ ok: true, reviewed: data });
    }
    if (input.action === "edit") {
      const { data, error } = await supabase.rpc("update_family_story_text", {
        p_story_id: input.story_id,
        p_transcript_original: input.transcript_original,
        p_transcript_translation: input.transcript_translation,
        p_adapted_story: input.adapted_story,
      });
      if (error) throw error;
      return NextResponse.json({ ok: true, updated: data });
    }
    if (input.action === "retry") {
      const { data, error } = await supabase.rpc("retry_family_story", {
        p_story_id: input.story_id,
      });
      if (error) throw error;
      return NextResponse.json({ ok: true, retried: data });
    }
    const { data, error } = await supabase.rpc(
      "create_roots_entry_from_story",
      {
        p_story_id: input.story_id,
        p_visibility: input.visibility,
      },
    );
    if (error) throw error;
    return NextResponse.json({ ok: true, entryId: data });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
