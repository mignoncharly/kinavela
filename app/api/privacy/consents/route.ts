import { NextResponse } from "next/server";
import { assertSameOrigin } from "@/lib/security/request";
import { productEmailConsentSchema } from "@/lib/validation/privacy";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return NextResponse.json({ ok: false }, { status: 401 });
  const { data, error } = await supabase.rpc("get_my_consents");
  if (error) return NextResponse.json({ ok: false }, { status: 503 });
  return NextResponse.json({ ok: true, consents: data ?? [] });
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = productEmailConsentSchema.parse(await request.json());
    const supabase = await createClient();
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return NextResponse.json({ ok: false }, { status: 401 });
    const { error } = await supabase.rpc("set_product_email_consent", {
      p_enabled: body.product_email,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_request" },
      { status: 400 },
    );
  }
}
