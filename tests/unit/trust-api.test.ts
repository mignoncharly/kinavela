import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/trust/route";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/security/request", () => ({ assertSameOrigin: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const user = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" };

function client() {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
  };
}

function request(body: object) {
  return new Request("https://kinavela.test/api/trust", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("trust workflow API", () => {
  beforeEach(() => vi.clearAllMocks());

  it("records the exact first-meeting context through the caller-bound RPC", async () => {
    const supabase = client();
    vi.mocked(createClient).mockResolvedValue(supabase as never);
    const response = await POST(
      request({
        action: "acknowledge_meeting_safety",
        context: "connection_meeting",
      }),
    );
    expect(response.status).toBe(200);
    expect(supabase.rpc).toHaveBeenCalledWith("acknowledge_meeting_safety", {
      p_context: "connection_meeting",
    });
  });

  it("requests Village review without accepting a client profile or family ID", async () => {
    const villageId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const supabase = client();
    vi.mocked(createClient).mockResolvedValue(supabase as never);
    const response = await POST(
      request({
        action: "request_community_verification",
        village_id: villageId,
      }),
    );
    expect(response.status).toBe(200);
    expect(supabase.rpc).toHaveBeenCalledWith(
      "request_community_verification",
      { p_village_id: villageId },
    );

    const invalid = await POST(
      request({
        action: "request_community_verification",
        village_id: villageId,
        profile_id: user.id,
      }),
    );
    expect(invalid.status).toBe(400);
  });
});
