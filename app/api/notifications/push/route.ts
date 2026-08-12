import { NextResponse } from "next/server";

import { assertSameOrigin } from "@/lib/security/request";
import { createClient } from "@/lib/supabase/server";
import { pushSubscriptionSchema } from "@/lib/validation/notifications";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = pushSubscriptionSchema.parse(await request.json());
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false }, { status: 401 });
    if (input.action === "register" && input.p256dh && input.auth) {
      const { error } = await supabase.rpc(
        "register_notification_push_subscription",
        {
          p_endpoint: input.endpoint,
          p_p256dh: input.p256dh,
          p_auth: input.auth,
        },
      );
      if (error) throw error;
    } else if (input.action === "revoke") {
      const { error } = await supabase.rpc(
        "revoke_notification_push_subscription",
        { p_endpoint: input.endpoint },
      );
      if (error) throw error;
    } else return NextResponse.json({ ok: false }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
