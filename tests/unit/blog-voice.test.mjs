import { describe, expect, it } from "vitest";

import {
  analysePost,
  bodyOf,
  placeholderAuthorFindings,
  referencedImages,
} from "../../scripts/check-blog-voice.mjs";

const rules = (source, locale = "de") =>
  analysePost(source, { locale, label: "t.md" }).map((finding) => finding.rule);

/** A short, specific, human-sounding German post. Should be silent. */
const goodGerman = `---
title: Warum wir Kinavela bauen
---

Im Oktober 2025 hat meine Tochter mich gefragt, warum Oma anders spricht.

Ich hatte keine gute Antwort. Wir wohnen seit sieben Jahren in Mainz, und
Zuhause reden wir Deutsch, weil es schneller geht. Das ist bequem. Es ist
auch der Grund, warum sie ihre Großmutter am Telefon kaum versteht.

Also habe ich angefangen, mitzuschreiben.
`;

describe("bodyOf", () => {
  it("drops frontmatter but keeps line numbers aligned", () => {
    const lines = bodyOf("---\ntitle: x\n---\n\nErste Zeile.");
    expect(lines[0]).toBe("");
    expect(lines[1]).toBe("");
    expect(lines[4]).toBe("Erste Zeile.");
  });

  it("blanks fenced code so examples are not linted as prose", () => {
    const lines = bodyOf("Text.\n\n```\nleverage delve\n```\n\nMehr.");
    expect(lines.join("\n")).not.toContain("leverage");
    expect(lines.join("\n")).toContain("Mehr.");
  });
});

describe("banned phrases are language-aware", () => {
  it("flags German tells in a German post", () => {
    expect(
      rules("In der heutigen schnelllebigen Zeit ist alles anders."),
    ).toContain("banned-phrase");
    expect(
      rules("Es ist wichtig zu beachten, dass Familien zählen."),
    ).toContain("banned-phrase");
  });

  it("flags English tells only in an English post", () => {
    expect(rules("We delve into the topic.", "en")).toContain("banned-phrase");
    // The same English word in a German post is not what the German list is for.
    expect(rules("Der Delve ist ein Ort.", "de")).not.toContain(
      "banned-phrase",
    );
  });

  it("flags French tells in a French post", () => {
    expect(rules("Dans le monde d'aujourd'hui, tout va vite.", "fr")).toContain(
      "banned-phrase",
    );
  });

  it("leaves natural German and French constructions alone", () => {
    // "nicht nur … sondern auch" is ordinary German, not an AI tell.
    expect(
      rules("Es geht nicht nur um Sprache, sondern auch um Essen."),
    ).not.toContain("banned-phrase");
    expect(
      rules("Non seulement la langue, mais aussi la cuisine.", "fr"),
    ).not.toContain("banned-phrase");
  });

  it("reports the offending line and the phrase", () => {
    const [finding] = analysePost("Zeile eins.\n\nTauchen wir ein.", {
      locale: "de",
      label: "post.md",
    });
    expect(finding.line).toBe(3);
    expect(finding.message).toContain("Tauchen wir ein");
    expect(finding.label).toBe("post.md");
  });
});

describe("structural tells", () => {
  it("flags a summary heading", () => {
    expect(rules("## Fazit\n\nAlso.")).toContain("conclusion-heading");
    expect(rules("## Conclusion\n\nSo.", "en")).toContain("conclusion-heading");
    expect(rules("## Der Anfang\n\nText.")).not.toContain("conclusion-heading");
  });

  it("flags a rhetorical question used as a heading", () => {
    expect(rules("## Was heißt das für uns?\n\nText.")).toContain(
      "question-heading",
    );
  });

  it("flags lists that are all exactly three items", () => {
    const monotonous = "- a\n- b\n- c\n\nText.\n\n- d\n- e\n- f\n";
    expect(rules(monotonous)).toContain("list-monotony");
  });

  it("does not flag varied lists, or a single three-item list", () => {
    expect(rules("- a\n- b\n- c\n\nText.\n\n- d\n- e\n")).not.toContain(
      "list-monotony",
    );
    expect(rules("- a\n- b\n- c\n")).not.toContain("list-monotony");
  });

  it("flags paragraphs that are all the same length", () => {
    const uniform = Array.from(
      { length: 6 },
      () => "Wort ".repeat(20).trim() + ".",
    ).join("\n\n");
    expect(rules(uniform)).toContain("uniform-paragraphs");
  });

  it("does not flag prose whose paragraphs vary", () => {
    expect(rules(goodGerman)).not.toContain("uniform-paragraphs");
  });

  it("flags heavy em-dash use", () => {
    expect(
      rules("Ein Satz — mit — sehr — vielen — Gedankenstrichen."),
    ).toContain("em-dash-density");
    expect(rules(goodGerman)).not.toContain("em-dash-density");
  });
});

describe("specificity proxy", () => {
  it("flags a long post that names nothing concrete", () => {
    const vague =
      "Gemeinschaft ist wertvoll für Familien. ".repeat(40) +
      "Wir glauben daran.";
    expect(rules(vague)).toContain("no-specifics");
  });

  it("accepts a post carrying a year, a number or a month", () => {
    const base = "Wir sprechen über Sprache und Familie. ".repeat(40);
    expect(rules(`${base} Das war 2025.`)).not.toContain("no-specifics");
    expect(rules(`${base} Es kostete 40 Euro.`)).not.toContain("no-specifics");
    expect(rules(`${base} Im Oktober kam der Brief.`)).not.toContain(
      "no-specifics",
    );
  });

  it("does not nag a short post", () => {
    expect(rules("Ein kurzer Gedanke ohne Zahlen.")).not.toContain(
      "no-specifics",
    );
  });
});

describe("author bios", () => {
  it("reports a bio still carrying the placeholder flag", () => {
    const findings = placeholderAuthorFindings(
      "export const blogAuthors = {\n  charles: {\n    placeholderBio: true,\n  },\n};",
      "content/blog/authors.ts",
    );
    expect(findings).toHaveLength(1);
    expect(findings[0].rule).toBe("placeholder-bio");
    expect(findings[0].line).toBe(3);
  });

  it("says nothing once the flag is gone", () => {
    expect(
      placeholderAuthorFindings("export const blogAuthors = {};", "a.ts"),
    ).toEqual([]);
  });
});

describe("privacy rules", () => {
  it("flags a German street address", () => {
    expect(rules("Wir trafen uns in der Nikolausstraße 6 in Mainz.")).toContain(
      "street-address",
    );
    expect(rules("12, rue des Écoles à Paris.", "fr")).toContain(
      "street-address",
    );
  });

  it("leaves a city or a street with no number alone", () => {
    expect(rules("Wir wohnen in Mainz, seit sieben Jahren.")).not.toContain(
      "street-address",
    );
    expect(rules("Ein Spaziergang durch die Bahnhofstraße.")).not.toContain(
      "street-address",
    );
  });

  it("flags a named school or nursery", () => {
    expect(rules("Sie geht in die Kita Sonnenschein.")).toContain(
      "child-institution",
    );
    expect(rules("Er wechselt aufs Gymnasium Gutenberg.")).toContain(
      "child-institution",
    );
  });

  it("does not flag the generic word without a name", () => {
    expect(rules("Einen Kita-Platz zu bekommen dauert lange.")).not.toContain(
      "child-institution",
    );
  });

  it("flags a quote with no recorded consent", () => {
    const quoting = "Sie sagte es so:\n\n> Wir sind hier angekommen.\n";
    expect(rules(quoting)).toContain("missing-consent");
  });

  it("accepts a quote once a consentRef is present", () => {
    const withConsent = `---
title: x
consentRef: c_7f2a91
---

Sie sagte:

> Wir sind hier angekommen.
`;
    expect(rules(withConsent)).not.toContain("missing-consent");
  });

  it("does not demand consent for a post with no quotes", () => {
    expect(rules(goodGerman)).not.toContain("missing-consent");
  });
});

describe("referenced images", () => {
  it("collects the hero image and inline images", () => {
    const source = `---
title: x
heroImage: /blog/hero.jpg
---

Text mit ![Bild](/blog/inline.png) darin.
`;
    expect(referencedImages(source).sort()).toEqual([
      "/blog/hero.jpg",
      "/blog/inline.png",
    ]);
  });

  it("ignores external images, which are not ours to strip", () => {
    expect(referencedImages("![x](https://example.com/a.jpg)")).toEqual([]);
  });
});

describe("a genuinely human post", () => {
  it("passes every rule", () => {
    expect(analysePost(goodGerman, { locale: "de", label: "good.md" })).toEqual(
      [],
    );
  });
});
