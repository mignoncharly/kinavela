import { describe, expect, it } from "vitest";

import { renderMarkdown } from "@/features/blog/markdown";

/**
 * The renderer's job is to be incapable of emitting dangerous HTML, so these
 * assertions are made against the parsed DOM rather than against the string.
 * Checking the string invites false alarms: `alt="&quot; onerror=&quot;x"` is
 * perfectly safe but contains the substring `onerror=`.
 */

const FORBIDDEN_ELEMENTS = [
  "script",
  "iframe",
  "object",
  "embed",
  "svg",
  "form",
  "style",
  "link",
  "base",
];

const ALLOWED_SCHEMES = ["https:", "http:", "mailto:"];

function parse(markdown: string) {
  return new DOMParser().parseFromString(
    `<body>${renderMarkdown(markdown)}</body>`,
    "text/html",
  );
}

function assertSafe(markdown: string) {
  const document_ = parse(markdown);

  for (const tag of FORBIDDEN_ELEMENTS) {
    expect(
      document_.querySelectorAll(tag).length,
      `<${tag}> survived rendering of ${markdown}`,
    ).toBe(0);
  }

  for (const element of document_.querySelectorAll("*")) {
    for (const attribute of element.attributes) {
      expect(
        attribute.name.toLowerCase().startsWith("on"),
        `${element.tagName} kept event handler ${attribute.name} from ${markdown}`,
      ).toBe(false);
    }
  }

  const urls = [
    ...[...document_.querySelectorAll("a")].map((a) => a.getAttribute("href")),
    ...[...document_.querySelectorAll("img")].map((img) =>
      img.getAttribute("src"),
    ),
  ].filter((value): value is string => value !== null);

  for (const url of urls) {
    if (url.startsWith("/") || url.startsWith("#")) continue;
    expect(
      ALLOWED_SCHEMES.includes(new URL(url).protocol),
      `disallowed scheme in ${url} from ${markdown}`,
    ).toBe(true);
  }
}

const payloads = [
  '<img src=x onerror="alert(1)">',
  '<a href="javascript:alert(1)">x</a>',
  "<svg/onload=alert(1)>",
  '<iframe src="//evil.example"></iframe>',
  "<style>body{display:none}</style>",
  '<base href="https://evil.example/">',
  "[x](javascript:alert(1))",
  "[x](  JAVASCRIPT:alert(1)  )",
  "[x](vbscript:msgbox)",
  "[x](data:text/html,<script>alert(1)</script>)",
  "![x](data:image/svg+xml,<svg onload=alert(1)>)",
  "[x](//evil.example/x)",
  '[x](https://a.example/" onmouseover="alert(1))',
  '![" onerror="alert(1)](/a.png)',
  '[x](/ok "t\\" onmouseover=\\"alert(1)")',
  "[x](https://a.example)\n\n<script>alert(1)</script>",
];

describe("blog markdown cannot emit dangerous HTML", () => {
  for (const payload of payloads) {
    it(`neutralises ${JSON.stringify(payload)}`, () => {
      assertSafe(payload);
    });
  }

  it("escapes rather than deletes, so the words survive", () => {
    const html = renderMarkdown("<svg/onload=alert(1)>");
    expect(html).toContain("&lt;svg");
    expect(parse("Ein <b>fettes</b> Wort.").body.textContent).toContain(
      "fettes",
    );
  });
});
