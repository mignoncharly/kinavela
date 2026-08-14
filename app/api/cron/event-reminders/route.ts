import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchNotificationDeliveries } from "@/lib/notifications/dispatcher";

export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const secret = process.env.EVENT_REMINDER_CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || secret.length < 32 || !authorization?.startsWith("Bearer ")) {
    return false;
  }
  const supplied = authorization.slice(7);
  const expectedBuffer = Buffer.from(secret);
  const suppliedBuffer = Buffer.from(supplied);
  return (
    expectedBuffer.length === suppliedBuffer.length &&
    timingSafeEqual(expectedBuffer, suppliedBuffer)
  );
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("dispatch_due_event_reminders");
  if (error) {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
  const playdateResult = await admin.rpc("dispatch_due_playdate_reminders");
  if (playdateResult.error) {
    return NextResponse.json({ ok: false, delivered: data }, { status: 503 });
  }
  try {
    return NextResponse.json({
      ok: true,
      delivered: data,
      playdatesDelivered: playdateResult.data,
      notifications: await dispatchNotificationDeliveries(),
    });
  } catch {
    return NextResponse.json({ ok: false, delivered: data }, { status: 503 });
  }
}
