import { NextResponse } from "next/server";
import { exportDownloadHeaders } from "@/lib/privacy/export-download";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ exportId: string }> },
) {
  const { exportId } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(exportId))
    return NextResponse.json({ ok: false }, { status: 400 });
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return NextResponse.json({ ok: false }, { status: 401 });
  const { data, error } = await supabase.rpc(
    "get_my_personal_data_export_path",
    { p_export_id: exportId },
  );
  if (error) return NextResponse.json({ ok: false }, { status: 404 });
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.file_path) return NextResponse.json({ ok: false }, { status: 404 });
  const { data: signed, error: signedError } = await createAdminClient()
    .storage.from("privacy-exports")
    .createSignedUrl(row.file_path, 600);
  if (signedError || !signed?.signedUrl)
    return NextResponse.json({ ok: false }, { status: 503 });
  try {
    const file = await fetch(signed.signedUrl, {
      cache: "no-store",
    });
    if (!file.ok || !file.body)
      return NextResponse.json({ ok: false }, { status: 503 });
    return new NextResponse(file.body, {
      headers: exportDownloadHeaders(
        exportId,
        file.headers.get("content-type"),
      ),
    });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
