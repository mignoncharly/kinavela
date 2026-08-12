import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { assertSameOrigin } from "@/lib/security/request";
import { hasAllowedFileSignature } from "@/lib/security/upload";
import { createClient } from "@/lib/supabase/server";
import { hashStoryToken } from "@/lib/security/story-token";

const audioTypes = new Set([
  "audio/mpeg",
  "audio/wav",
  "audio/mp4",
  "audio/webm",
]);

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const form = await request.formData();
    const token = String(form.get("token") ?? "").trim();
    const title = String(form.get("title") ?? "").trim();
    const language = String(form.get("original_language") ?? "")
      .trim()
      .toLowerCase();
    const file = form.get("file");
    if (
      token.length < 30 ||
      token.length > 100 ||
      title.length < 2 ||
      title.length > 160 ||
      !(file instanceof File) ||
      !audioTypes.has(file.type) ||
      file.size < 1 ||
      file.size > 25_000_000
    ) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    if (!(await hasAllowedFileSignature(file, file.type))) {
      return NextResponse.json(
        { ok: false, error: "invalid_file_signature" },
        { status: 400 },
      );
    }
    const supabase = await createClient();
    const tokenHash = hashStoryToken(token);
    const { data: prepared, error: prepareError } = await supabase.rpc(
      "prepare_story_upload",
      {
        p_token_hash: tokenHash,
        p_mime_type: file.type,
        p_size_bytes: file.size,
      },
    );
    if (prepareError) throw prepareError;
    const upload = Array.isArray(prepared) ? prepared[0] : prepared;
    if (!upload?.upload_path) throw new Error("story_upload_not_prepared");
    const admin = createAdminClient();
    const { error: uploadError } = await admin.storage
      .from("story-audio")
      .upload(upload.upload_path, file, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: true,
      });
    if (uploadError) throw uploadError;
    const { data: storyId, error: submitError } = await supabase.rpc(
      "submit_anonymous_story",
      {
        p_token_hash: tokenHash,
        p_audio_path: upload.upload_path,
        p_title: title,
        p_original_language: language || null,
        p_mime_type: file.type,
        p_size_bytes: file.size,
      },
    );
    if (submitError) {
      await admin.storage.from("story-audio").remove([upload.upload_path]);
      throw submitError;
    }
    return NextResponse.json({ ok: true, storyId });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
