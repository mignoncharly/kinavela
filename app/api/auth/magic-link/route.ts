import { NextResponse } from "next/server";

import { sendAuthEmail } from "@/features/auth/email";
import {
  authEmailExists,
  confirmationUrl,
  enforceAuthRateLimit,
} from "@/features/auth/server";
import { assertSameOrigin } from "@/lib/security/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailActionSchema } from "@/lib/validation/auth";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = emailActionSchema.parse(await request.json());
    await enforceAuthRateLimit(request, input.email, "magic_link");
    if (await authEmailExists(input.email)) {
      const { data, error } = await createAdminClient().auth.admin.generateLink(
        { type: "magiclink", email: input.email },
      );
      if (!error && data.properties.hashed_token) {
        await sendAuthEmail(
          input.email,
          input.locale,
          "magiclink",
          confirmationUrl(
            data.properties.hashed_token,
            "magiclink",
            input.locale,
          ),
        );
      }
    }
    return NextResponse.json(
      { ok: true, message: "link_sent_if_registered" },
      { status: 202 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    if (message === "rate_limited")
      return NextResponse.json(
        { ok: false, error: "rate_limited" },
        { status: 429 },
      );
    if (message === "invalid_origin")
      return NextResponse.json(
        { ok: false, error: "invalid_request" },
        { status: 403 },
      );
    console.error("Magic link failed", { message });
    return NextResponse.json(
      { ok: false, error: "service_unavailable" },
      { status: 503 },
    );
  }
}
