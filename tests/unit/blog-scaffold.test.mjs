import { describe, expect, it } from "vitest";

import { humaniseSlug, scaffoldPost } from "../../scripts/new-blog-post.mjs";
import { parseFrontmatter } from "../../features/blog/frontmatter.ts";

describe("humaniseSlug", () => {
  it("turns a slug into a title worth editing", () => {
    expect(humaniseSlug("warum-wir-kinavela-bauen")).toBe(
      "Warum wir kinavela bauen",
    );
    expect(humaniseSlug("ndole")).toBe("Ndole");
  });
});

describe("scaffoldPost", () => {
  const source = scaffoldPost({ slug: "warum-wir-bauen" });

  it("produces frontmatter the real parser accepts", () => {
    const { frontmatter, body } = parseFrontmatter(source, "scaffold.md");
    expect(frontmatter.title).toBe("Warum wir bauen");
    expect(frontmatter.author).toBe("admin");
    expect(frontmatter.originalLocale).toBe("de");
    expect(frontmatter.excerpt.length).toBeGreaterThanOrEqual(20);
    // An empty page is the point: anything pre-written would be the first
    // thing a reader sees and the last thing anyone remembers to delete.
    expect(body).toBe("");
  });

  it("dates the draft far enough ahead to stay out of the build", () => {
    const { frontmatter } = parseFrontmatter(source, "scaffold.md");
    expect(frontmatter.published).toBe("2099-01-01");
    expect(new Date(frontmatter.published).getTime()).toBeGreaterThan(
      Date.now(),
    );
  });

  it("records a translator only on a genuine translation", () => {
    const translated = scaffoldPost({
      slug: "warum-wir-bauen",
      locale: "fr",
      originalLocale: "de",
      translator: "Awa Diallo",
    });
    const { frontmatter } = parseFrontmatter(translated, "fr.md");
    expect(frontmatter.translator).toBe("Awa Diallo");
    expect(frontmatter.originalLocale).toBe("de");
  });

  it("refuses a translation of itself", () => {
    expect(() =>
      scaffoldPost({
        slug: "x",
        locale: "de",
        originalLocale: "de",
        translator: "Someone",
      }),
    ).toThrow(/originalLocale must be another language/);
  });

  it("rejects a bad slug or an unknown language", () => {
    expect(() => scaffoldPost({ slug: "Nicht Gültig!" })).toThrow(
      /not a valid slug/,
    );
    expect(() => scaffoldPost({ slug: "ok", locale: "xx" })).toThrow(
      /not one of de, fr, en/,
    );
  });
});
