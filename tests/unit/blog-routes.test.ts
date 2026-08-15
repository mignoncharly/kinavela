import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { fill } from "@/features/blog/copy";
import { blogIndex, loadBlogEntries } from "@/features/blog/registry";
import { blogPostLanguageAlternates } from "@/features/blog/seo";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { formatLanguage } from "@/lib/i18n/format";
import { locales } from "@/lib/i18n/config";

const FIXTURES = join(process.cwd(), "tests", "fixtures", "blog");
const NOW = new Date("2026-03-01T00:00:00Z");
const entries = loadBlogEntries(FIXTURES, NOW);

describe("blog index", () => {
  it("shows a post in the reader's language when it exists", () => {
    const french = blogIndex("fr", entries);
    const item = french.find((entry) => entry.post.slug === "erster-beitrag");
    expect(item?.fallback).toBe(false);
    expect(item?.locale).toBe("fr");
    expect(item?.post.title).toBe("Un premier article");
  });

  it("falls back to the original language and flags it", () => {
    const english = blogIndex("en", entries);
    const item = english.find((entry) => entry.post.slug === "nur-deutsch");
    expect(item?.fallback).toBe(true);
    expect(item?.locale).toBe("de");
    expect(item?.post.title).toBe("Nur auf Deutsch");
  });

  it("lists every published post in every language", () => {
    for (const locale of locales) {
      expect(blogIndex(locale, entries).map((item) => item.post.slug)).toEqual([
        "nur-deutsch",
        "erster-beitrag",
      ]);
    }
  });

  it("never surfaces a future-dated post", () => {
    for (const locale of locales) {
      expect(
        blogIndex(locale, entries).some((item) => item.post.slug === "geplant"),
      ).toBe(false);
    }
  });

  it("orders newest first by the shown post's date", () => {
    const dates = blogIndex("de", entries).map((item) => item.post.published);
    expect([...dates].sort().reverse()).toEqual(dates);
  });
});

describe("blog hreflang", () => {
  it("announces only the languages that exist", () => {
    expect(
      blogPostLanguageAlternates("erster-beitrag", ["de", "fr"], "de"),
    ).toEqual({
      de: "/de/blog/erster-beitrag",
      fr: "/fr/blog/erster-beitrag",
      "x-default": "/de/blog/erster-beitrag",
    });
  });

  it("omits a language with no translation rather than 404ing crawlers", () => {
    const alternates = blogPostLanguageAlternates("nur-deutsch", ["de"], "de");
    expect(alternates).not.toHaveProperty("fr");
    expect(alternates).not.toHaveProperty("en");
  });

  it("points x-default at the original language, not the site default", () => {
    expect(
      blogPostLanguageAlternates("x", ["fr", "en"], "fr")["x-default"],
    ).toBe("/fr/blog/x");
  });

  it("keeps x-default resolvable when the original is not published", () => {
    expect(blogPostLanguageAlternates("x", ["en"], "de")["x-default"]).toBe(
      "/en/blog/x",
    );
    expect(blogPostLanguageAlternates("x", [], "de")).toEqual({});
  });
});

describe("blog chrome copy", () => {
  it("carries every blog string in all three languages", () => {
    const german = getDictionary("de").blog;
    for (const locale of locales) {
      const dictionary = getDictionary(locale).blog;
      expect(Object.keys(dictionary).sort()).toEqual(
        Object.keys(german).sort(),
      );
      for (const value of Object.values(dictionary)) {
        expect(typeof value).toBe("string");
        expect((value as string).trim()).not.toHaveLength(0);
      }
    }
  });

  it("keeps the placeholders the pages actually substitute", () => {
    for (const locale of locales) {
      const dictionary = getDictionary(locale).blog;
      expect(dictionary.readingTime).toContain("{minutes}");
      expect(dictionary.onlyIn).toContain("{language}");
      expect(dictionary.translatedBy).toContain("{translator}");
    }
  });

  it("reads naturally once a language name is substituted", () => {
    expect(
      fill(getDictionary("de").blog.onlyIn, {
        language: formatLanguage("de", "de"),
      }),
    ).toBe("Nur auf Deutsch");
    expect(
      fill(getDictionary("fr").blog.onlyIn, {
        language: formatLanguage("fr", "de"),
      }),
    ).toBe("Uniquement en allemand");
    expect(
      fill(getDictionary("en").blog.onlyIn, {
        language: formatLanguage("en", "de"),
      }),
    ).toBe("Only in German");
  });

  it("leaves an unknown placeholder visible instead of blanking it", () => {
    expect(fill("{a} und {b}", { a: "eins" })).toBe("eins und {b}");
  });
});
