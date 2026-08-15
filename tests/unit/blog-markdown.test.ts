import { describe, expect, it } from "vitest";

import {
  readingMinutes,
  renderMarkdown,
  safeUrl,
} from "@/features/blog/markdown";

describe("blog markdown rendering", () => {
  it("shifts headings down so the page keeps the only h1", () => {
    const html = renderMarkdown("# Überschrift\n\n## Unterpunkt");
    expect(html).toContain("<h2>Überschrift</h2>");
    expect(html).toContain("<h3>Unterpunkt</h3>");
    expect(html).not.toContain("<h1>");
  });

  it("caps heading depth at h6", () => {
    expect(renderMarkdown("###### tief")).toContain("<h6>");
  });

  it("drops raw HTML but keeps its text", () => {
    const html = renderMarkdown('<script>alert("x")</script>\n\nDanach.');
    expect(html).not.toContain("<script");
    expect(html).toContain("Danach.");
  });

  it("drops inline HTML tags without deleting the sentence", () => {
    const html = renderMarkdown("Ein <b>fettes</b> Wort.");
    expect(html).not.toContain("<b>");
    expect(html).toContain("fettes");
  });

  it("degrades an unsafe link to its own text", () => {
    const html = renderMarkdown("[klick](javascript:alert(1))");
    expect(html).not.toContain("javascript:");
    expect(html).toContain("klick");
    expect(html).not.toContain("<a ");
  });

  it("keeps safe links and marks external ones", () => {
    const external = renderMarkdown("[x](https://example.com/a)");
    expect(external).toContain('href="https://example.com/a"');
    expect(external).toContain('rel="noopener noreferrer"');

    const internal = renderMarkdown("[y](/de/community/berlin)");
    expect(internal).toContain('href="/de/community/berlin"');
    expect(internal).not.toContain("rel=");
  });

  it("renders images lazily and refuses unsafe sources", () => {
    expect(renderMarkdown("![alt](/blog/a.jpg)")).toContain('loading="lazy"');
    const unsafe = renderMarkdown("![alt](javascript:alert(1))");
    expect(unsafe).not.toContain("<img");
    expect(unsafe).toContain("alt");
  });

  it("still renders ordinary markdown", () => {
    const html = renderMarkdown("- eins\n- zwei\n\n**fett**");
    expect(html).toContain("<li>eins</li>");
    expect(html).toContain("<strong>fett</strong>");
  });

  describe("safeUrl", () => {
    it("allows https, http, mailto, relative and fragment URLs", () => {
      expect(safeUrl("https://a.example/b")).toBe("https://a.example/b");
      expect(safeUrl("mailto:contact@kinavela.com")).toBe(
        "mailto:contact@kinavela.com",
      );
      expect(safeUrl("/de/blog")).toBe("/de/blog");
      expect(safeUrl("#abschnitt")).toBe("#abschnitt");
    });

    it("refuses javascript, data, protocol-relative and empty URLs", () => {
      expect(safeUrl("javascript:alert(1)")).toBeNull();
      expect(safeUrl("JavaScript:alert(1)")).toBeNull();
      expect(safeUrl("data:text/html;base64,PHN2Zz4=")).toBeNull();
      expect(safeUrl("//evil.example/x")).toBeNull();
      expect(safeUrl("   ")).toBeNull();
    });
  });

  describe("readingMinutes", () => {
    it("never reports less than a minute", () => {
      expect(readingMinutes("Kurz.")).toBe(1);
    });

    it("scales with word count and ignores code blocks", () => {
      const body = Array.from({ length: 600 }, () => "wort").join(" ");
      expect(readingMinutes(body)).toBe(3);
      expect(readingMinutes("```\n" + body + "\n```")).toBe(1);
    });
  });
});
