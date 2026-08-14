import { NextResponse } from "next/server";

import { assertSameOrigin } from "@/lib/security/request";
import { createClient } from "@/lib/supabase/server";
import { onboardingDraftSchema } from "@/lib/validation/onboarding";

async function authenticatedClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? supabase : null;
}

export async function PUT(request: Request) {
  try {
    assertSameOrigin(request);
    const supabase = await authenticatedClient();
    if (!supabase) return NextResponse.json({ ok: false }, { status: 401 });
    const draft = onboardingDraftSchema.parse(await request.json());
    const { error } = await supabase.rpc("save_my_onboarding_draft", {
      p_draft: draft,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const supabase = await authenticatedClient();
    if (!supabase) return NextResponse.json({ ok: false }, { status: 401 });
    const { error } = await supabase.rpc("delete_my_onboarding_draft");
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
