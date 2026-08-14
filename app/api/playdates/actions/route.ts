import { NextResponse } from "next/server";
import { assertSameOrigin } from "@/lib/security/request";
import { createClient } from "@/lib/supabase/server";
import { playdateActionSchema } from "@/lib/validation/playdates";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = playdateActionSchema.parse(await request.json());
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false }, { status: 401 });
    let result;
    if (input.action === "accept")
      result = await supabase.rpc("respond_playdate", {
        p_playdate_id: input.playdate_id,
        p_accept: true,
        p_option_id: input.option_id,
        p_number_of_adults: input.number_of_adults,
        p_number_of_children: input.number_of_children,
      });
    else if (input.action === "decline")
      result = await supabase.rpc("respond_playdate", {
        p_playdate_id: input.playdate_id,
        p_accept: false,
        p_option_id: null,
        p_number_of_adults: 1,
        p_number_of_children: 0,
      });
    else if (input.action === "cancel")
      result = await supabase.rpc("cancel_playdate", {
        p_playdate_id: input.playdate_id,
      });
    else if (input.action === "remind")
      result = await supabase.rpc("send_playdate_reminder", {
        p_playdate_id: input.playdate_id,
      });
    else if (input.action === "read_reminders")
      result = await supabase.rpc("mark_playdate_reminders_read", {
        p_playdate_id: input.playdate_id,
      });
    else
      result = await supabase.rpc("submit_playdate_report", {
        p_playdate_id: input.playdate_id,
        p_reason: input.reason,
        p_details: input.details || null,
      });
    if (result.error) throw result.error;
    return NextResponse.json({ ok: true, result: result.data });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
