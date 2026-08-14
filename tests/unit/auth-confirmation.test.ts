import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/auth/confirm/route";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/env.public", () => ({
  publicEnv: { NEXT_PUBLIC_APP_URL: "https://www.kinavela.test" },
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const tokenHash = "a".repeat(64);

function recoveryRequest(parameters = "") {
  return new Request(
    `https://internal.test/auth/confirm?token_hash=${tokenHash}&type=recovery&locale=en${parameters}`,
  );
}

function client(result: unknown) {
  return {
    auth: { verifyOtp: vi.fn().mockResolvedValue(result) },
  };
}

describe("auth confirmation route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("establishes a recovery session and redirects to the password form", async () => {
    const supabase = client({
      data: { user: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" } },
      error: null,
    });
    vi.mocked(createClient).mockResolvedValue(supabase as never);

    const response = await GET(recoveryRequest());

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://www.kinavela.test/en/auth/update-password",
    );
    expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({
      token_hash: tokenHash,
      type: "recovery",
    });
  });

  it("redirects an expired or used token to a clear login error", async () => {
    vi.mocked(createClient).mockResolvedValue(
      client({ data: { user: null }, error: { message: "expired" } }) as never,
    );

    const response = await GET(recoveryRequest());

    expect(response.headers.get("location")).toBe(
      "https://www.kinavela.test/en/auth/login?error=expired_link",
    );
  });

  it("turns provider failures into a safe temporary error redirect", async () => {
    vi.mocked(createClient).mockRejectedValue(
      new Error("provider unavailable"),
    );
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const response = await GET(recoveryRequest());

    expect(response.headers.get("location")).toBe(
      "https://www.kinavela.test/en/auth/login?error=service_unavailable",
    );
    expect(consoleError).toHaveBeenCalledWith("Auth confirmation failed", {
      type: "recovery",
      message: "provider unavailable",
    });
    consoleError.mockRestore();
  });
});
