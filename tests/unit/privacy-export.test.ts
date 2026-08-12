import { describe, expect, it } from "vitest";

import { exportDownloadHeaders } from "@/lib/privacy/export-download";

describe("privacy export downloads", () => {
  it("forces a private attachment response", () => {
    expect(
      exportDownloadHeaders(
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        "application/json",
      ),
    ).toEqual({
      "Cache-Control": "private, no-store",
      "Content-Disposition":
        'attachment; filename="kinavela-data-export-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.json"',
      "Content-Type": "application/json",
    });
  });

  it("falls back to JSON when storage omits a content type", () => {
    expect(
      exportDownloadHeaders("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", null)[
        "Content-Type"
      ],
    ).toBe("application/json");
  });
});
