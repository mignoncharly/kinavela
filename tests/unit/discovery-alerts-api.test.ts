import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/discovery/alerts/route";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/security/request", () => ({ assertSameOrigin: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const user = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" };

function client(message: string | null = null) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    rpc: vi.fn().mockResolvedValue({
      data: message ? null : "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      error: message ? { message } : null,
    }),
  };
}

function request(body: object) {
  return new Request("https://kinavela.test/api/discovery/alerts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("discovery alert API", () => {
  beforeEach(() => vi.clearAllMocks());

  it("subscribes through the owner-checked RPC", async () => {
    const supabase = client();
    vi.mocked(createClient).mockResolvedValue(supabase as never);
    const response = await POST(
      request({ action: "subscribe", radius_km: 40 }),
    );
    expect(response.status).toBe(200);
    expect(supabase.rpc).toHaveBeenCalledWith("update_my_discovery_alert", {
      p_active: true,
      p_radius_km: 40,
    });
  });

  it("revokes without accepting a client-supplied family identifier", async () => {
    const supabase = client();
    vi.mocked(createClient).mockResolvedValue(supabase as never);
    const response = await POST(request({ action: "revoke" }));
    expect(response.status).toBe(200);
    expect(supabase.rpc).toHaveBeenCalledWith("update_my_discovery_alert", {
      p_active: false,
      p_radius_km: null,
    });
    const invalid = await POST(
      request({
        action: "revoke",
        family_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      }),
    );
    expect(invalid.status).toBe(400);
  });

  it.each([
    ["owner_required", 403],
    ["invalid_alert_radius", 400],
    ["location_required", 400],
  ])("returns the safe %s error", async (errorCode, status) => {
    vi.mocked(createClient).mockResolvedValue(client(errorCode) as never);
    const response = await POST(
      request({ action: "subscribe", radius_km: 40 }),
    );
    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toMatchObject({ error: errorCode });
  });
});
