import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { loadBlogEntries } from "@/features/blog/registry";
import { blogSitemapEntries, newestBlogDate } from "@/features/blog/sitemap";

const FIXTURES = join(process.cwd(), "tests", "fixtures", "blog");
const NOW = new Date("2026-03-01T00:00:00Z");
const FALLBACK = new Date("2026-08-11T00:00:00Z");
const entries = loadBlogEntries(FIXTURES, NOW);

const rows = blogSitemapEntries(entries, FALLBACK);
const rowFor = (url: string) =>
  rows.find((row) => row.url === `https://www.kinavela.com${url}`);

describe("blog sitemap entries", () => {
  it("lists the index in every language", () => {
    for (const locale of ["de", "fr", "en"]) {
      expect(rowFor(`/${locale}/blog`)).toBeDefined();
    }
  });

  it("lists a post only in the languages it exists in", () => {
    expect(rowFor("/de/blog/erster-beitrag")).toBeDefined();
    expect(rowFor("/fr/blog/erster-beitrag")).toBeDefined();
    // No English translation exists — announcing one would be a 404.
    expect(rowFor("/en/blog/erster-beitrag")).toBeUndefined();
    expect(rowFor("/fr/blog/nur-deutsch")).toBeUndefined();
  });

  it("never lists a future-dated post", () => {
    expect(rows.some((row) => row.url.includes("geplant"))).toBe(false);
  });

  it("uses each post's own date as lastModified", () => {
    expect(rowFor("/de/blog/erster-beitrag")?.lastModified).toEqual(
      new Date("2026-01-10T00:00:00Z"),
    );
    expect(rowFor("/fr/blog/erster-beitrag")?.lastModified).toEqual(
      new Date("2026-01-12T00:00:00Z"),
    );
  });

  it("dates the index from the newest post, not a hardcoded day", () => {
    expect(rowFor("/de/blog")?.lastModified).toEqual(
      new Date("2026-02-01T00:00:00Z"),
    );
    expect(rowFor("/de/blog")?.lastModified).not.toEqual(FALLBACK);
  });

  it("confines a post's hreflang to the languages it has", () => {
    const languages = rowFor("/de/blog/nur-deutsch")?.alternates.languages;
    expect(Object.keys(languages ?? {}).sort()).toEqual(["de", "x-default"]);
    expect(languages?.["x-default"]).toBe(
      "https://www.kinavela.com/de/blog/nur-deutsch",
    );
  });

  it("uses fully-qualified URLs, which sitemaps require", () => {
    for (const row of rows) {
      expect(row.url.startsWith("https://www.kinavela.com/")).toBe(true);
      for (const href of Object.values(row.alternates.languages)) {
        expect(href.startsWith("https://www.kinavela.com/")).toBe(true);
      }
    }
  });

  it("falls back to the given date when there are no posts at all", () => {
    const empty = blogSitemapEntries([], FALLBACK);
    expect(empty).toHaveLength(3);
    expect(empty[0]?.lastModified).toEqual(FALLBACK);
    expect(newestBlogDate([])).toBeNull();
  });
});
