import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ storyId: string }> },
) {
  try {
    const { storyId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false }, { status: 401 });
    const { data: path, error } = await supabase.rpc("get_story_audio_path", {
      p_story_id: storyId,
    });
    if (error || typeof path !== "string")
      return NextResponse.json({ ok: false }, { status: 404 });
    const { data: signed, error: signedError } = await createAdminClient()
      .storage.from("story-audio")
      .createSignedUrl(path, 300);
    if (signedError || !signed?.signedUrl)
      return NextResponse.json({ ok: false }, { status: 404 });
    return NextResponse.redirect(signed.signedUrl);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
