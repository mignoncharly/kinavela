import { NextResponse } from "next/server";
import { assertSameOrigin } from "@/lib/security/request";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const supabase = await createClient();
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return NextResponse.json({ ok: false }, { status: 401 });
    const { data, error } = await supabase.rpc("request_personal_data_export");
    if (error) throw error;
    return NextResponse.json({ ok: true, exportId: data });
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_request" },
      { status: 400 },
    );
  }
}

export async function GET() {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return NextResponse.json({ ok: false }, { status: 401 });
  const { data, error } = await supabase.rpc("list_my_personal_data_exports");
  if (error) return NextResponse.json({ ok: false }, { status: 503 });
  return NextResponse.json({ ok: true, exports: data ?? [] });
}
