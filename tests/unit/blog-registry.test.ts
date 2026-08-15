import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { assertAuthorsResolve } from "@/features/blog/authors";
import {
  BLOG_CONTENT_ROOT,
  blogPostLocales,
  getBlogPost,
  listBlogPosts,
  loadBlogEntries,
} from "@/features/blog/registry";

const FIXTURES = join(process.cwd(), "tests", "fixtures", "blog");
const NOW = new Date("2026-03-01T00:00:00Z");

const entries = loadBlogEntries(FIXTURES, NOW);

describe("blog registry", () => {
  it("derives availability from the files that exist", () => {
    expect(blogPostLocales("erster-beitrag", entries)).toEqual(["de", "fr"]);
    expect(blogPostLocales("nur-deutsch", entries)).toEqual(["de"]);
  });

  it("withholds posts dated in the future", () => {
    expect(entries.map((entry) => entry.slug)).not.toContain("geplant");
    expect(getBlogPost("geplant", "de", entries)).toBeUndefined();
  });

  it("returns nothing for a locale the post was never translated into", () => {
    expect(getBlogPost("nur-deutsch", "en", entries)).toBeUndefined();
    expect(getBlogPost("nur-deutsch", "de", entries)?.title).toBe(
      "Nur auf Deutsch",
    );
  });

  it("marks translations and leaves the original unmarked", () => {
    expect(getBlogPost("erster-beitrag", "de", entries)?.translated).toBe(
      false,
    );
    const french = getBlogPost("erster-beitrag", "fr", entries);
    expect(french?.translated).toBe(true);
    expect(french?.translator).toBe("Awa Diallo");
  });

  it("lists a locale's posts newest first", () => {
    const german = listBlogPosts("de", entries);
    expect(german.map((post) => post.slug)).toEqual([
      "nur-deutsch",
      "erster-beitrag",
    ]);
    expect(listBlogPosts("en", entries)).toEqual([]);
  });

  it("renders the body and sanitises it on the way through", () => {
    const post = getBlogPost("erster-beitrag", "de", entries);
    expect(post?.html).toContain("<h2>Überschrift</h2>");
    expect(post?.html).not.toContain("<script");
    expect(post?.html).not.toContain("javascript:");
    expect(post?.readingMinutes).toBeGreaterThanOrEqual(1);
  });

  it("treats a missing content directory as empty, not as a failure", () => {
    expect(loadBlogEntries(join(FIXTURES, "does-not-exist"), NOW)).toEqual([]);
  });

  it("rejects a post whose author key does not resolve", () => {
    expect(() => assertAuthorsResolve(entries, ["charles"])).not.toThrow();
    expect(() => assertAuthorsResolve(entries, ["someone-else"])).toThrow(
      /unknown author "charles"/,
    );
  });

  it("loads the real content directory, ignoring the files beside the posts", () => {
    // authors.ts and README.md live in content/blog/ and must never be mistaken
    // for posts. This also fails the build the day a real post is malformed.
    const real = loadBlogEntries(BLOG_CONTENT_ROOT, NOW);
    expect(Array.isArray(real)).toBe(true);
    expect(() => assertAuthorsResolve(real)).not.toThrow();
    for (const entry of real) {
      expect(entry.availableLocales.length).toBeGreaterThan(0);
    }
  });
});
