import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { assertSameOrigin } from "@/lib/security/request";
import { hasAllowedFileSignature } from "@/lib/security/upload";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const mediaTypes = new Map([
  ["image/jpeg", "photo"],
  ["image/png", "photo"],
  ["image/webp", "photo"],
  ["audio/mpeg", "audio"],
  ["audio/wav", "audio"],
  ["audio/mp4", "audio"],
  ["video/mp4", "video"],
  ["application/pdf", "document"],
]);

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const form = await request.formData();
    const passportId = String(form.get("passport_id") ?? "");
    const entryId = String(form.get("entry_id") ?? "");
    const file = form.get("file");
    if (
      !/^[0-9a-f-]{36}$/.test(passportId) ||
      !/^[0-9a-f-]{36}$/.test(entryId) ||
      !(file instanceof File)
    ) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    const kind = mediaTypes.get(file.type);
    if (!kind || file.size < 1 || file.size > 25_000_000) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    if (!(await hasAllowedFileSignature(file, file.type))) {
      return NextResponse.json(
        { ok: false, error: "invalid_file_signature" },
        { status: 400 },
      );
    }
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false }, { status: 401 });
    const { data: canManage, error: authorizationError } = await supabase.rpc(
      "can_manage_roots_passport",
      { p_passport_id: passportId },
    );
    if (authorizationError || canManage !== true)
      return NextResponse.json({ ok: false }, { status: 403 });
    const extension =
      file.name
        .split(".")
        .pop()
        ?.toLowerCase()
        .replace(/[^a-z0-9]/g, "") || "bin";
    const path = `${passportId}/${entryId}/${randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("roots-media")
      .upload(path, file, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false,
      });
    if (uploadError) throw uploadError;
    const { error: attachError } = await supabase.rpc("attach_roots_media", {
      p_entry_id: entryId,
      p_media_path: path,
      p_media_kind: kind,
      p_media_mime_type: file.type,
      p_media_size_bytes: file.size,
    });
    if (attachError) {
      await supabase.storage.from("roots-media").remove([path]);
      throw attachError;
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
