import { NextResponse } from "next/server";

import { assertSameOrigin } from "@/lib/security/request";
import { createClient } from "@/lib/supabase/server";
import { missionActionSchema } from "@/lib/validation/missions";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = missionActionSchema.parse(await request.json());
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false }, { status: 401 });

    if (input.action === "assign") {
      const { data, error } = await supabase.rpc("assign_village_mission", {
        p_village_id: input.village_id,
        p_mission_id: input.mission_id,
      });
      if (error) throw error;
      return NextResponse.json({ ok: true, villageMissionId: data });
    }

    if (input.action === "start") {
      const { data, error } = await supabase.rpc("start_cultural_mission", {
        p_mission_id: input.mission_id,
        p_village_mission_id: input.village_mission_id ?? null,
      });
      if (error) throw error;
      return NextResponse.json({ ok: true, progressId: data });
    }

    const { data, error } = await supabase.rpc(
      "complete_cultural_mission_step",
      {
        p_mission_id: input.mission_id,
        p_step_id: input.step_id,
        p_village_mission_id: input.village_mission_id ?? null,
      },
    );
    if (error) throw error;
    return NextResponse.json({ ok: true, progress: data });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
