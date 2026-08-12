import { describe, expect, it } from "vitest";

import { hasAllowedFileSignature } from "@/lib/security/upload";

describe("upload security", () => {
  it("accepts a file whose magic bytes match its declared MIME type", async () => {
    const jpeg = new File(
      [new Uint8Array([0xff, 0xd8, 0xff, 0xe0])],
      "photo.jpg",
      { type: "image/jpeg" },
    );
    await expect(hasAllowedFileSignature(jpeg, "image/jpeg")).resolves.toBe(
      true,
    );
  });

  it("rejects MIME spoofing", async () => {
    const fakeJpeg = new File(["<script>alert(1)</script>"], "photo.jpg", {
      type: "image/jpeg",
    });
    await expect(hasAllowedFileSignature(fakeJpeg, "image/jpeg")).resolves.toBe(
      false,
    );
  });

  it("recognises private story audio containers", async () => {
    const webm = new File(
      [new Uint8Array([0x1a, 0x45, 0xdf, 0xa3])],
      "story.webm",
      { type: "audio/webm" },
    );
    await expect(hasAllowedFileSignature(webm, "audio/webm")).resolves.toBe(
      true,
    );
  });
});
