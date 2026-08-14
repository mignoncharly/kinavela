import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { assertSameOrigin } from "@/lib/security/request";
import { hasAllowedFileSignature } from "@/lib/security/upload";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
    const { data: oldPath, error: attachError } = await supabase.rpc(
      "replace_roots_media",
      {
        p_entry_id: entryId,
        p_media_path: path,
        p_media_kind: kind,
        p_media_mime_type: file.type,
        p_media_size_bytes: file.size,
      },
    );
    if (attachError) {
      await supabase.storage.from("roots-media").remove([path]);
      throw attachError;
    }
    if (typeof oldPath === "string" && oldPath !== path) {
      await createAdminClient().storage.from("roots-media").remove([oldPath]);
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}

export async function GET(request: Request) {
  try {
    const entryId = new URL(request.url).searchParams.get("entry_id") ?? "";
    if (!uuidPattern.test(entryId))
      return NextResponse.json({ ok: false }, { status: 400 });
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false }, { status: 401 });
    const { data, error } = await supabase.rpc("get_roots_media_path", {
      p_entry_id: entryId,
    });
    const row = Array.isArray(data) ? data[0] : data;
    if (error || !row?.media_path)
      return NextResponse.json({ ok: false }, { status: 404 });
    const { data: signed, error: signedError } = await createAdminClient()
      .storage.from("roots-media")
      .createSignedUrl(row.media_path, 300, {
        download: row.media_kind === "document",
      });
    if (signedError || !signed?.signedUrl)
      return NextResponse.json({ ok: false }, { status: 503 });
    return NextResponse.redirect(signed.signedUrl);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const body = (await request.json()) as { entry_id?: unknown };
    if (typeof body.entry_id !== "string" || !uuidPattern.test(body.entry_id))
      return NextResponse.json({ ok: false }, { status: 400 });
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false }, { status: 401 });
    const { data: path, error } = await supabase.rpc("detach_roots_media", {
      p_entry_id: body.entry_id,
    });
    if (error) throw error;
    if (typeof path === "string") {
      const removed = await createAdminClient()
        .storage.from("roots-media")
        .remove([path]);
      if (removed.error) throw removed.error;
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
