import { describe, expect, it } from "vitest";

import manifest from "@/app/manifest";

describe("PWA contract", () => {
  it("declares an installable standalone application with a stable scope", () => {
    const value = manifest();
    expect(value.display).toBe("standalone");
    expect(value.scope).toBe("/");
    expect(value.start_url).toBe("/de");
    expect(value.icons?.some((icon) => icon.src === "/icon.svg")).toBe(true);
  });

  it("keeps the offline entry point outside authenticated application routes", () => {
    const value = manifest();
    expect(value.start_url).not.toContain("/app");
    expect(value.start_url).not.toContain("/api");
  });
});
