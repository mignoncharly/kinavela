import { beforeEach, describe, expect, it, vi } from "vitest";

import { PATCH } from "@/app/api/family/settings/route";
import { createClient } from "@/lib/supabase/server";
import { validFamilySettings } from "@/tests/fixtures/family-settings";

vi.mock("@/lib/security/request", () => ({ assertSameOrigin: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const user = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" };

function client(errorMessage: string | null = null) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    rpc: vi.fn().mockResolvedValue({
      data: errorMessage ? null : "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
      error: errorMessage ? { message: errorMessage } : null,
    }),
  };
}

describe("family settings API", () => {
  beforeEach(() => vi.clearAllMocks());

  it("passes a validated complete settings document to the owner RPC", async () => {
    const supabase = client();
    vi.mocked(createClient).mockResolvedValue(supabase as never);
    const response = await PATCH(
      new Request("https://kinavela.test/api/family/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(validFamilySettings),
      }),
    );

    expect(response.status).toBe(200);
    expect(supabase.rpc).toHaveBeenCalledWith("update_my_family_settings", {
      p_payload: validFamilySettings,
    });
  });

  it.each([
    ["owner_required", 403],
    ["child_has_cultural_history", 400],
  ])("returns the safe %s database error", async (errorCode, status) => {
    vi.mocked(createClient).mockResolvedValue(client(errorCode) as never);
    const response = await PATCH(
      new Request("https://kinavela.test/api/family/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(validFamilySettings),
      }),
    );

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toMatchObject({ error: errorCode });
  });

  it("rejects incomplete settings before the RPC", async () => {
    const supabase = client();
    vi.mocked(createClient).mockResolvedValue(supabase as never);
    const response = await PATCH(
      new Request("https://kinavela.test/api/family/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ family: { name: "Incomplete" } }),
      }),
    );

    expect(response.status).toBe(400);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});
