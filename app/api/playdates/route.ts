import { NextResponse } from "next/server";
import { assertSameOrigin } from "@/lib/security/request";
import { createClient } from "@/lib/supabase/server";
import { playdateCreateSchema } from "@/lib/validation/playdates";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = playdateCreateSchema.parse(await request.json());
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false }, { status: 401 });
    const { data, error } = await supabase.rpc("create_playdate", {
      p_connection_id: input.connection_id,
      p_title: input.title,
      p_approximate_location: input.approximate_location,
      p_exact_address: input.exact_address,
      p_time_options: input.time_options,
      p_number_of_adults: input.number_of_adults,
      p_number_of_children: input.number_of_children,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true, playdateId: data });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
