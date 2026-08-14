import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/villages/support/route";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/security/request", () => ({ assertSameOrigin: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const user = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" };
const villageId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const postId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function client() {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
  };
}

function request(body: object) {
  return new Request("https://kinavela.test/api/villages/support", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Village support API", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates through a caller-bound RPC without accepting author IDs", async () => {
    const supabase = client();
    vi.mocked(createClient).mockResolvedValue(supabase as never);
    const response = await POST(
      request({
        action: "create",
        village_id: villageId,
        content_type: "help_request",
        category: "administration",
        title: "Understanding a local form",
        body: "Which general municipal information helped your family?",
        privacy_confirmed: true,
      }),
    );
    expect(response.status).toBe(200);
    expect(supabase.rpc).toHaveBeenCalledWith(
      "create_village_support_post",
      expect.objectContaining({ p_village_id: villageId }),
    );

    const invalid = await POST(
      request({
        action: "close",
        post_id: postId,
        author_profile_id: user.id,
      }),
    );
    expect(invalid.status).toBe(400);
  });

  it("submits only fixed support reports", async () => {
    const supabase = client();
    vi.mocked(createClient).mockResolvedValue(supabase as never);
    const response = await POST(
      request({
        action: "report",
        post_id: postId,
        reason: "unsafe_advice",
        details: "This general advice may create a safety risk.",
      }),
    );
    expect(response.status).toBe(200);
    expect(supabase.rpc).toHaveBeenCalledWith("submit_village_support_report", {
      p_post_id: postId,
      p_reply_id: null,
      p_reason: "unsafe_advice",
      p_details: "This general advice may create a safety risk.",
    });
  });
});
