import { NextResponse } from "next/server";

import {
  parseCreatedInvitation,
  parseInvitationClaim,
} from "@/features/invitations/results";
import { errorMessage } from "@/lib/api/error-message";
import { assertSameOrigin } from "@/lib/security/request";
import { createClient } from "@/lib/supabase/server";
import { invitationActionSchema } from "@/lib/validation/invitations";

const knownErrors = new Set([
  "not_authorized",
  "owner_required",
  "invalid_invitation",
  "invitation_not_available",
  "event_not_available",
  "village_not_available",
  "village_full",
  "geographic_eligibility_required",
  "membership_already_exists",
]);

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = invitationActionSchema.parse(await request.json());
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

    if (input.action === "create") {
      const { data, error } = await supabase.rpc("create_invitation_link", {
        p_invitation_kind: input.invitation_kind,
        p_village_id: input.village_id,
        p_event_id: input.event_id,
        p_locale: input.locale,
      });
      if (error) throw error;
      const parsed = parseCreatedInvitation(data);
      if (!parsed.success) throw new Error("invalid_invitation_result");
      return NextResponse.json({ ok: true, invitation: parsed.data[0] });
    }

    if (input.action === "revoke") {
      const { error } = await supabase.rpc("revoke_invitation_link", {
        p_invitation_id: input.invitation_id,
      });
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (input.action === "attribute") {
      const { error } = await supabase.rpc("record_referral_attribution", {
        p_token: input.token,
      });
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    const { data, error } = await supabase.rpc(
      "accept_village_invitation_link",
      { p_token: input.token },
    );
    if (error) throw error;
    const parsed = parseInvitationClaim(data);
    if (!parsed.success) throw new Error("invalid_invitation_result");
    return NextResponse.json({ ok: true, destination: parsed.data[0] });
  } catch (error) {
    const message = errorMessage(error);
    const known = [...knownErrors].find((code) => message.includes(code));
    return NextResponse.json(
      { ok: false, error: known ?? "invalid_request" },
      {
        status:
          known === "not_authorized" || known === "owner_required" ? 403 : 400,
      },
    );
  }
}
