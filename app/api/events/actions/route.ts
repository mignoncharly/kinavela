import { NextResponse } from "next/server";

import { assertSameOrigin } from "@/lib/security/request";
import { createClient } from "@/lib/supabase/server";
import { eventActionSchema } from "@/lib/validation/events";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = eventActionSchema.parse(await request.json());
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false }, { status: 401 });
    let result;
    switch (input.action) {
      case "cancel":
        result = await supabase.rpc("cancel_village_event", {
          p_event_id: input.event_id,
        });
        break;
      case "remind":
        result = await supabase.rpc("send_event_reminder", {
          p_event_id: input.event_id,
        });
        break;
      case "rsvp":
        result = await supabase.rpc("rsvp_village_event", {
          p_event_id: input.event_id,
          p_status: input.status,
          p_number_of_adults: input.number_of_adults,
          p_number_of_children: input.number_of_children,
        });
        break;
      case "attendance":
        result = await supabase.rpc("confirm_event_attendance", {
          p_event_id: input.event_id,
          p_family_id: input.family_id,
          p_attended: input.attended,
        });
        break;
      case "read_reminders":
        result = await supabase.rpc("mark_event_reminder_read", {
          p_event_id: input.event_id,
        });
        break;
    }
    if (result.error) throw result.error;
    return NextResponse.json({ ok: true, result: result.data });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
