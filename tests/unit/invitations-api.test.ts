import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/invitations/route";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/security/request", () => ({ assertSameOrigin: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const user = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" };
const token = "A".repeat(43);

function client(data: unknown, message: string | null = null) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    rpc: vi.fn().mockResolvedValue({
      data: message ? null : data,
      error: message ? { message } : null,
    }),
  };
}

function request(body: object) {
  return new Request("https://kinavela.test/api/invitations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("invitation API", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a Village event link through the authorization RPC", async () => {
    const invitationId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const villageId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const eventId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    const supabase = client([
      {
        invitation_id: invitationId,
        raw_token: token,
        expires_at: "2026-09-10T14:00:00+00:00",
      },
    ]);
    vi.mocked(createClient).mockResolvedValue(supabase as never);

    const response = await POST(
      request({
        action: "create",
        invitation_kind: "village",
        village_id: villageId,
        event_id: eventId,
        locale: "fr",
      }),
    );

    expect(response.status).toBe(200);
    expect(supabase.rpc).toHaveBeenCalledWith("create_invitation_link", {
      p_invitation_kind: "village",
      p_village_id: villageId,
      p_event_id: eventId,
      p_locale: "fr",
    });
  });

  it("accepts a Village link only through the guarded acceptance RPC", async () => {
    const destination = {
      village_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      event_id: null,
    };
    const supabase = client([destination]);
    vi.mocked(createClient).mockResolvedValue(supabase as never);

    const response = await POST(request({ action: "accept_village", token }));

    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      destination,
    });
    expect(supabase.rpc).toHaveBeenCalledWith(
      "accept_village_invitation_link",
      { p_token: token },
    );
  });

  it.each([
    ["owner_required", 403],
    ["village_full", 400],
    ["geographic_eligibility_required", 400],
  ])("returns the safe %s database error", async (errorCode, status) => {
    vi.mocked(createClient).mockResolvedValue(client(null, errorCode) as never);
    const response = await POST(request({ action: "accept_village", token }));
    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toMatchObject({ error: errorCode });
  });

  it("rejects malformed tokens before an RPC call", async () => {
    const supabase = client(null);
    vi.mocked(createClient).mockResolvedValue(supabase as never);
    const response = await POST(
      request({ action: "accept_village", token: "malformed" }),
    );
    expect(response.status).toBe(400);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});
