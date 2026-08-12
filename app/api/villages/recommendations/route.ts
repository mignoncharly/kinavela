import { NextResponse } from "next/server";

import { assertSameOrigin } from "@/lib/security/request";
import { createClient } from "@/lib/supabase/server";
import { villageRecommendationActionSchema } from "@/lib/validation/village-discovery";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = villageRecommendationActionSchema.parse(await request.json());
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false }, { status: 401 });

    if (input.action === "dismiss") {
      const { error } = await supabase.rpc(
        "dismiss_village_cluster_recommendation",
        { p_country_id: input.country_id },
      );
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    const { data, error } = await supabase.rpc(
      "start_village_cluster_recommendation",
      {
        p_country_id: input.country_id,
        p_name: input.name,
        p_description: input.description,
      },
    );
    if (error) throw error;
    return NextResponse.json({ ok: true, villageId: data });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
