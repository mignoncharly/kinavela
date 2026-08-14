import { NextResponse } from "next/server";

import { assertSameOrigin } from "@/lib/security/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { rootsActionSchema } from "@/lib/validation/roots";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = rootsActionSchema.parse(await request.json());
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false }, { status: 401 });

    if (input.action === "delete_entry") {
      const { data: path, error } = await supabase.rpc(
        "delete_roots_passport_entry_v2",
        { p_entry_id: input.entry_id },
      );
      if (error) throw error;
      if (typeof path === "string") {
        const removed = await createAdminClient()
          .storage.from("roots-media")
          .remove([path]);
        if (removed.error) throw removed.error;
      }
      return NextResponse.json({ ok: true });
    }
    if (input.action === "export") {
      const { data, error } = await supabase.rpc(
        "request_roots_passport_export",
        { p_child_id: input.child_id },
      );
      if (error) throw error;
      return NextResponse.json({ ok: true, exportId: data });
    }
    if (input.action === "retry_export") {
      const { error } = await supabase.rpc("retry_roots_passport_export", {
        p_export_id: input.export_id,
      });
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }
    if (input.action === "update_entry") {
      const payload = {
        type: input.type,
        title: input.title,
        description: input.description ?? null,
        occurred_at: input.occurred_at,
        visibility: input.visibility,
        culture_id: input.culture_id,
        language_id: input.language_id,
        event_id: input.event_id,
        mission_id: input.mission_id,
        village_id: input.village_id,
      };
      const { error } = await supabase.rpc("update_roots_passport_entry", {
        p_entry_id: input.entry_id,
        p_payload: payload,
      });
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }
    if (input.action === "mission_entry") {
      const { data, error } = await supabase.rpc(
        "create_roots_entry_from_mission",
        {
          p_child_id: input.child_id,
          p_mission_id: input.mission_id,
          p_title: input.title,
          p_description: input.description,
          p_occurred_at: input.occurred_at ?? new Date().toISOString(),
          p_visibility: input.visibility,
        },
      );
      if (error) throw error;
      return NextResponse.json({ ok: true, entryId: data });
    }

    const { data, error } = await supabase.rpc("create_roots_passport_entry", {
      p_payload: {
        child_id: input.child_id,
        type: input.type,
        title: input.title,
        description: input.description ?? null,
        occurred_at: input.occurred_at ?? new Date().toISOString(),
        visibility: input.visibility,
        culture_id: input.culture_id ?? null,
        language_id: input.language_id ?? null,
        event_id: input.event_id ?? null,
        mission_id: input.mission_id ?? null,
        village_id: input.village_id ?? null,
      },
    });
    if (error) throw error;
    return NextResponse.json({ ok: true, entryId: data });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
