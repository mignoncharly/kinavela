import { describe, expect, it } from "vitest";
import { GET as localizedManifest } from "@/app/[locale]/manifest.webmanifest/route";
import { readFileSync } from "node:fs";

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

  it.each(["de", "fr", "en"] as const)(
    "creates a locale-specific manifest for %s",
    async (locale) => {
      const response = await localizedManifest(
        new Request(`https://www.kinavela.com/${locale}/manifest.webmanifest`),
        { params: Promise.resolve({ locale }) },
      );
      const value = await response.json();
      expect(response.headers.get("content-type")).toContain(
        "application/manifest+json",
      );
      expect(value.lang).toBe(locale);
      expect(value.start_url).toBe(`/${locale}`);
      expect(value.id).toBe(`/${locale}`);
      expect(value.description).toBeTruthy();
    },
  );

  it("keeps offline navigation and fallback push bodies locale-aware", () => {
    const worker = readFileSync("public/sw.js", "utf8");
    expect(worker).toContain("kinavela-shell-v3");
    expect(worker).toContain("/offline?locale=fr");
    expect(worker).toContain("Vous avez une nouvelle mise à jour familiale.");
    expect(worker).toContain("Du hast ein neues Familien-Update.");
  });
});
