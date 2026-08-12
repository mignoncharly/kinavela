import { NextResponse } from "next/server";

import { billingEntitlementsSchema } from "@/lib/validation/billing";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const { data, error } = await supabase.rpc("get_my_entitlements");
  const value = Array.isArray(data) ? data[0] : data;
  const parsed = billingEntitlementsSchema.safeParse(value);
  if (error || !parsed.success)
    return NextResponse.json({ ok: false }, { status: 400 });
  return NextResponse.json({ ok: true, entitlements: parsed.data });
}
