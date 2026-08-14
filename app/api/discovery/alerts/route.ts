import { NextResponse } from "next/server";

import { errorMessage } from "@/lib/api/error-message";
import { assertSameOrigin } from "@/lib/security/request";
import { createClient } from "@/lib/supabase/server";
import { discoveryAlertActionSchema } from "@/lib/validation/discovery-alerts";

const knownErrors = new Set([
  "owner_required",
  "location_required",
  "invalid_alert_radius",
  "alert_not_available",
]);

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = discoveryAlertActionSchema.parse(await request.json());
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "not_authenticated" },
        { status: 401 },
      );
    }
    const { data, error } = await supabase.rpc("update_my_discovery_alert", {
      p_active: input.action === "subscribe",
      p_radius_km: input.action === "subscribe" ? input.radius_km : null,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true, subscription_id: data });
  } catch (error) {
    const message = errorMessage(error);
    const known = [...knownErrors].find((code) => message.includes(code));
    return NextResponse.json(
      { ok: false, error: known ?? "invalid_request" },
      { status: known === "owner_required" ? 403 : 400 },
    );
  }
}
