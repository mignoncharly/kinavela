import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("healthcheck");

    if (error || data !== true) {
      return NextResponse.json(
        { status: "unavailable", service: "kinavela" },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json(
      { status: "ready", service: "kinavela", database: "ok" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { status: "unavailable", service: "kinavela" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
