import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { dispatchNotificationDeliveries } from "@/lib/notifications/dispatcher";

export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const secret = process.env.EVENT_REMINDER_CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || secret.length < 32 || !authorization?.startsWith("Bearer "))
    return false;
  const supplied = Buffer.from(authorization.slice(7));
  const expected = Buffer.from(secret);
  return (
    supplied.length === expected.length && timingSafeEqual(supplied, expected)
  );
}

export async function POST(request: Request) {
  if (!authorized(request))
    return NextResponse.json({ ok: false }, { status: 401 });
  try {
    return NextResponse.json({
      ok: true,
      ...(await dispatchNotificationDeliveries()),
    });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
