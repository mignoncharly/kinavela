import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { blogAuthors } from "@/content/blog/authors";
import { assertCommunityLinksResolve } from "@/features/blog/authors";
import { renderBlogFeed } from "@/features/blog/feed";
import {
  blogAuthorId,
  blogIndexJsonLd,
  blogPostJsonLd,
  serializeJsonLd,
} from "@/features/blog/jsonld";
import { getBlogPost, loadBlogEntries } from "@/features/blog/registry";
import { ORGANIZATION_ID, WEBSITE_ID } from "@/features/blog/site";
import type { BlogAuthor, BlogPost } from "@/features/blog/types";

const FIXTURES = join(process.cwd(), "tests", "fixtures", "blog");
const NOW = new Date("2026-03-01T00:00:00Z");
const entries = loadBlogEntries(FIXTURES, NOW);

const post = getBlogPost("erster-beitrag", "de", entries) as BlogPost;
const author = blogAuthors.admin as BlogAuthor;

function nodesOf(graph: { "@graph": Record<string, unknown>[] }) {
  return Object.fromEntries(
    graph["@graph"].map((node) => [node["@type"] as string, node]),
  );
}

describe("blog post structured data", () => {
  const graph = blogPostJsonLd({ post, author, locale: "de" });
  const nodes = nodesOf(graph);

  it("references the existing organisation and website rather than redeclaring them", () => {
    expect(nodes.BlogPosting?.publisher).toEqual({ "@id": ORGANIZATION_ID });
    expect(nodes.WebPage?.isPartOf).toEqual({ "@id": WEBSITE_ID });
    // A second Organization node would split the entity being claimed.
    expect(graph["@graph"].map((node) => node["@type"])).not.toContain(
      "Organization",
    );
  });

  it("carries the dates search engines read", () => {
    expect(nodes.BlogPosting?.datePublished).toBe("2026-01-10");
    expect(nodes.BlogPosting?.dateModified).toBe("2026-01-10");
  });

  it("uses absolute site URLs everywhere, never a relative path", () => {
    const serialised = JSON.stringify(graph);
    const urls = (serialised.match(/"https?:\/\/[^"]+"/g) ?? []).filter(
      // @context is legitimately schema.org, not a site URL.
      (url) => !url.startsWith('"https://schema.org'),
    );
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) {
      expect(url).toContain("https://www.kinavela.com");
    }
    expect(nodes.BlogPosting?.url).toBe(
      "https://www.kinavela.com/de/blog/erster-beitrag",
    );
    expect(nodes.BlogPosting?.image).toBe(
      "https://www.kinavela.com/de/blog/erster-beitrag/opengraph-image",
    );
  });

  it("attributes the post to a Person node with a stable id", () => {
    expect(nodes.BlogPosting?.author).toEqual({
      "@id": blogAuthorId("admin"),
    });
    expect(nodes.Person?.["@id"]).toBe(blogAuthorId("admin"));
    expect(nodes.Person?.name).toBe(author.name);
  });

  it("builds a three-step breadcrumb", () => {
    const items = nodes.BreadcrumbList?.itemListElement as {
      position: number;
      name: string;
    }[];
    expect(items.map((item) => item.position)).toEqual([1, 2, 3]);
    expect(items.at(-1)?.name).toBe(post.title);
  });

  it("declares the translator when the post is a translation", () => {
    const french = getBlogPost("erster-beitrag", "fr", entries) as BlogPost;
    const translated = nodesOf(
      blogPostJsonLd({ post: french, author, locale: "fr" }),
    );
    expect(translated.BlogPosting?.translator).toEqual({
      "@type": "Person",
      name: "Awa Diallo",
    });
    expect(nodes.BlogPosting?.translator).toBeUndefined();
  });

  it("truncates an over-long headline instead of emitting it whole", () => {
    const long = { ...post, title: "x".repeat(200) };
    const built = nodesOf(blogPostJsonLd({ post: long, author, locale: "de" }));
    expect((built.BlogPosting?.headline as string).length).toBe(110);
  });

  it("survives a post with no resolvable author", () => {
    const graphWithout = blogPostJsonLd({
      post,
      author: undefined,
      locale: "de",
    });
    expect(graphWithout["@graph"].map((node) => node["@type"])).not.toContain(
      "Person",
    );
    expect(nodesOf(graphWithout).BlogPosting?.author).toBeUndefined();
  });
});

describe("blog index structured data", () => {
  it("lists posts as references to their own nodes", () => {
    const graph = blogIndexJsonLd({
      locale: "de",
      name: "Blog",
      description: "…",
      posts: [post],
    });
    const nodes = nodesOf(graph);
    expect(nodes.Blog?.blogPost).toEqual([
      { "@id": "https://www.kinavela.com/de/blog/erster-beitrag#article" },
    ]);
  });
});

describe("JSON-LD serialisation", () => {
  it("escapes < so a title cannot close the script tag", () => {
    const output = serializeJsonLd({ title: "</script><script>alert(1)" });
    expect(output).not.toContain("</script>");
    expect(output).toContain("\\u003c");
  });
});

describe("blog RSS feed", () => {
  const feed = renderBlogFeed({
    locale: "de",
    title: "Blog · Kinavela",
    description: "Beschreibung",
    posts: [post],
  });

  it("is well-formed XML that a reader can parse", () => {
    const parsed = new DOMParser().parseFromString(feed, "application/xml");
    expect(parsed.querySelector("parsererror")).toBeNull();
    expect(parsed.querySelectorAll("item")).toHaveLength(1);
  });

  it("uses RFC 822 dates, not the ISO dates from frontmatter", () => {
    expect(feed).toContain("<pubDate>Sat, 10 Jan 2026 00:00:00 GMT</pubDate>");
    expect(feed).not.toContain("<pubDate>2026-01-10</pubDate>");
  });

  it("points every link at an absolute URL", () => {
    expect(feed).toContain(
      "<link>https://www.kinavela.com/de/blog/erster-beitrag</link>",
    );
    expect(feed).toContain('href="https://www.kinavela.com/de/feed.xml"');
  });

  it("escapes markup in titles rather than emitting it", () => {
    const hostile = renderBlogFeed({
      locale: "de",
      title: "t",
      description: "d",
      posts: [{ ...post, title: "A & B <tag>", excerpt: '"quoted"' }],
    });
    expect(hostile).toContain("A &amp; B &lt;tag&gt;");
    const parsed = new DOMParser().parseFromString(hostile, "application/xml");
    expect(parsed.querySelector("parsererror")).toBeNull();
  });

  it("stays valid with no posts at all", () => {
    const empty = renderBlogFeed({
      locale: "en",
      title: "t",
      description: "d",
      posts: [],
    });
    const parsed = new DOMParser().parseFromString(empty, "application/xml");
    expect(parsed.querySelector("parsererror")).toBeNull();
    expect(parsed.querySelectorAll("item")).toHaveLength(0);
  });
});

describe("community cross-links", () => {
  it("accepts a real community slug and rejects a typo", () => {
    const linked = [
      {
        ...entries[0]!,
        byLocale: {
          de: { ...post, community: "cameroonian-families-in-munich" },
        },
        availableLocales: ["de" as const],
      },
    ];
    expect(() => assertCommunityLinksResolve(linked)).not.toThrow();

    const broken = [
      {
        ...entries[0]!,
        byLocale: { de: { ...post, community: "families-in-atlantis" } },
        availableLocales: ["de" as const],
      },
    ];
    expect(() => assertCommunityLinksResolve(broken)).toThrow(
      /unknown community page "families-in-atlantis"/,
    );
  });
});
