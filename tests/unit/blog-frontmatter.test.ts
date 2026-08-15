import { describe, expect, it } from "vitest";

import {
  parseFrontmatter,
  splitFrontmatter,
} from "@/features/blog/frontmatter";

const valid = `---
title: Warum wir Kinavela bauen
excerpt: Meine Tochter hat mich letzten Herbst gefragt, warum Oma anders spricht.
author: charles
published: 2026-08-20
originalLocale: de
tags: [familie, sprache]
---

Der Text beginnt hier.`;

describe("blog frontmatter", () => {
  it("splits the fence and keeps the body", () => {
    const { data, body } = splitFrontmatter(valid, "test.md");
    expect(data.title).toBe("Warum wir Kinavela bauen");
    expect(data.tags).toEqual(["familie", "sprache"]);
    expect(body).toBe("Der Text beginnt hier.");
  });

  it("keeps colons and apostrophes inside unquoted values", () => {
    const source = `---
title: Warum wir bauen: eine Geschichte
excerpt: L'école, la langue et tout ce qui reste quand on part de chez soi.
author: charles
published: 2026-08-20
originalLocale: fr
---

Texte.`;
    const { frontmatter } = parseFrontmatter(source, "test.md");
    expect(frontmatter.title).toBe("Warum wir bauen: eine Geschichte");
    expect(frontmatter.excerpt).toContain("L'école");
  });

  it("strips surrounding quotes but not inner ones", () => {
    const { data } = splitFrontmatter(
      `---\ntitle: "Ndolé: ein Rezept"\n---\n\nx`,
      "test.md",
    );
    expect(data.title).toBe("Ndolé: ein Rezept");
  });

  it("accepts CRLF line endings", () => {
    const { body } = splitFrontmatter(valid.replace(/\n/g, "\r\n"), "test.md");
    expect(body).toBe("Der Text beginnt hier.");
  });

  it("names the file and line when a line is malformed", () => {
    const broken = `---\ntitle: Gut\ndiese Zeile ist kaputt\n---\n\nx`;
    expect(() => splitFrontmatter(broken, "content/blog/x/de.md")).toThrow(
      /content\/blog\/x\/de\.md:3/,
    );
  });

  it("rejects a missing fence, an unclosed fence, empty values and duplicates", () => {
    expect(() => splitFrontmatter("kein fence", "t.md")).toThrow(/must start/);
    expect(() => splitFrontmatter("---\ntitle: x\n\nbody", "t.md")).toThrow(
      /never closed/,
    );
    expect(() => splitFrontmatter("---\ntitle:\n---\n", "t.md")).toThrow(
      /has no value/,
    );
    expect(() =>
      splitFrontmatter("---\ntitle: a\ntitle: b\n---\n", "t.md"),
    ).toThrow(/duplicate key/);
  });

  it("rejects unknown keys rather than ignoring them", () => {
    const source = valid.replace("tags: [familie, sprache]", "autor: charles");
    expect(() => parseFrontmatter(source, "t.md")).toThrow(
      /invalid frontmatter/,
    );
  });

  it("rejects dates that are not real calendar days", () => {
    const source = valid.replace("2026-08-20", "2026-02-31");
    expect(() => parseFrontmatter(source, "t.md")).toThrow(
      /not a real calendar date/,
    );
  });

  it("requires heroAlt whenever heroImage is set", () => {
    const source = valid.replace(
      "tags: [familie, sprache]",
      "heroImage: /blog/hero.jpg",
    );
    expect(() => parseFrontmatter(source, "t.md")).toThrow(/heroAlt/);
  });

  it("defaults tags to an empty list", () => {
    const source = valid.replace("tags: [familie, sprache]\n", "");
    const { frontmatter } = parseFrontmatter(source, "t.md");
    expect(frontmatter.tags).toEqual([]);
  });
});
