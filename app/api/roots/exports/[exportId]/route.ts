import { NextResponse } from "next/server";

import { exportDownloadHeaders } from "@/lib/privacy/export-download";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ exportId: string }> },
) {
  const { exportId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(exportId))
    return NextResponse.json({ ok: false }, { status: 400 });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const { data, error } = await supabase.rpc(
    "get_my_roots_passport_export_path",
    { p_export_id: exportId },
  );
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row?.file_path)
    return NextResponse.json({ ok: false }, { status: 404 });
  const { data: signed, error: signedError } = await createAdminClient()
    .storage.from("roots-exports")
    .createSignedUrl(row.file_path, 300);
  if (signedError || !signed?.signedUrl)
    return NextResponse.json({ ok: false }, { status: 503 });
  const response = await fetch(signed.signedUrl, { cache: "no-store" });
  if (!response.ok || !response.body)
    return NextResponse.json({ ok: false }, { status: 503 });
  return new NextResponse(response.body, {
    headers: exportDownloadHeaders(exportId, "application/json"),
  });
}
