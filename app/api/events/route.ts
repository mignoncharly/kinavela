import { NextResponse } from "next/server";

import { assertSameOrigin } from "@/lib/security/request";
import { createClient } from "@/lib/supabase/server";
import { eventCreateSchema, eventUpdateSchema } from "@/lib/validation/events";

async function authenticatedClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = eventCreateSchema.parse(await request.json());
    const { supabase, user } = await authenticatedClient();
    if (!user) return NextResponse.json({ ok: false }, { status: 401 });
    const { data, error } = await supabase.rpc("create_village_event", {
      p_village_id: input.village_id,
      p_title: input.title,
      p_description: input.description,
      p_category: input.category,
      p_starts_at: input.starts_at,
      p_ends_at: input.ends_at,
      p_location_name: input.location_name,
      p_location_city: input.location_city,
      p_location_address: input.location_address,
      p_public_location_description: input.public_location_description,
      p_address_visibility: input.address_visibility,
      p_max_families: input.max_families,
      p_registration_deadline: input.registration_deadline,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true, eventId: data });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const input = eventUpdateSchema.parse(await request.json());
    const { supabase, user } = await authenticatedClient();
    if (!user) return NextResponse.json({ ok: false }, { status: 401 });
    const { error } = await supabase.rpc("update_village_event", {
      p_event_id: input.event_id,
      p_title: input.title,
      p_description: input.description,
      p_category: input.category,
      p_starts_at: input.starts_at,
      p_ends_at: input.ends_at,
      p_location_name: input.location_name,
      p_location_city: input.location_city,
      p_location_address: input.location_address,
      p_public_location_description: input.public_location_description,
      p_address_visibility: input.address_visibility,
      p_max_families: input.max_families,
      p_registration_deadline: input.registration_deadline,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
