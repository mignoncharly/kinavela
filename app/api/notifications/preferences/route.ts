import { NextResponse } from "next/server";

import { assertSameOrigin } from "@/lib/security/request";
import { createClient } from "@/lib/supabase/server";
import {
  notificationPreferencesActionSchema,
  notificationPreferencesSchema,
} from "@/lib/validation/notifications";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const { data, error } = await supabase.rpc("get_notification_preferences");
  const value = Array.isArray(data) ? data[0] : data;
  const parsed = notificationPreferencesSchema.safeParse(value);
  if (error || !parsed.success)
    return NextResponse.json({ ok: false }, { status: 400 });
  return NextResponse.json({ ok: true, preferences: parsed.data });
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = notificationPreferencesActionSchema.parse(
      await request.json(),
    );
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false }, { status: 401 });
    const { error } = await supabase.rpc("update_notification_preferences_v2", {
      p_email_enabled: input.email_enabled,
      p_push_enabled: input.push_enabled,
      p_community_enabled: input.community_enabled,
      p_events_enabled: input.events_enabled,
      p_direct_enabled: input.direct_enabled,
      p_heritage_enabled: input.heritage_enabled,
      p_safety_enabled: input.safety_enabled,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
