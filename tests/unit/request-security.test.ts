import { afterEach, describe, expect, it, vi } from "vitest";

describe("same-origin request security", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("accepts the configured www and apex origins while rejecting unsafe origins", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "test-publishable-key-long-enough",
    );
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://www.kinavela.example");
    vi.resetModules();

    const { assertSameOrigin } = await import("@/lib/security/request");

    expect(() =>
      assertSameOrigin(
        new Request("https://www.kinavela.example/api/messages", {
          headers: { origin: "https://www.kinavela.example" },
        }),
      ),
    ).not.toThrow();

    expect(() =>
      assertSameOrigin(
        new Request("https://kinavela.example/api/messages", {
          headers: { origin: "https://kinavela.example" },
        }),
      ),
    ).not.toThrow();

    expect(() =>
      assertSameOrigin(
        new Request("https://kinavela.example/api/messages", {
          headers: { origin: "https://evil.example" },
        }),
      ),
    ).toThrow("invalid_origin");

    expect(() =>
      assertSameOrigin(
        new Request("https://www.kinavela.example/api/messages", {
          headers: { origin: "http://kinavela.example" },
        }),
      ),
    ).toThrow("invalid_origin");

    expect(() =>
      assertSameOrigin(
        new Request("https://www.kinavela.example/api/messages", {
          headers: { origin: "https://www.kinavela.example.evil.example" },
        }),
      ),
    ).toThrow("invalid_origin");

    expect(() =>
      assertSameOrigin(
        new Request("https://www.kinavela.example/api/messages", {
          headers: { origin: "not a valid origin" },
        }),
      ),
    ).toThrow("invalid_origin");

    expect(() =>
      assertSameOrigin(new Request("https://kinavela.example/api/messages")),
    ).toThrow("invalid_origin");
  });
});
