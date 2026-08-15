import type { Locale } from "@/lib/i18n/config";
import { absoluteUrl } from "./site";
import type { BlogPost } from "./types";

const XML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

function escapeXml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) => XML_ESCAPES[character] ?? character,
  );
}

/** RSS dates are RFC 822; a bare YYYY-MM-DD is not valid there. */
function rfc822(date: string) {
  return new Date(`${date}T00:00:00Z`).toUTCString();
}

export function renderBlogFeed({
  locale,
  title,
  description,
  posts,
}: {
  locale: Locale;
  title: string;
  description: string;
  posts: BlogPost[];
}) {
  const feedUrl = absoluteUrl(`/${locale}/feed.xml`);
  const blogUrl = absoluteUrl(`/${locale}/blog`);
  const latest = posts[0];

  const items = posts
    .map((post) => {
      const url = absoluteUrl(`/${post.locale}/blog/${post.slug}`);
      return [
        "    <item>",
        `      <title>${escapeXml(post.title)}</title>`,
        `      <link>${escapeXml(url)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(url)}</guid>`,
        `      <pubDate>${rfc822(post.published)}</pubDate>`,
        `      <description>${escapeXml(post.excerpt)}</description>`,
        ...post.tags.map(
          (tag) => `      <category>${escapeXml(tag)}</category>`,
        ),
        "    </item>",
      ].join("\n");
    })
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    `    <title>${escapeXml(title)}</title>`,
    `    <link>${escapeXml(blogUrl)}</link>`,
    `    <description>${escapeXml(description)}</description>`,
    `    <language>${locale}</language>`,
    `    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />`,
    ...(latest
      ? [`    <lastBuildDate>${rfc822(latest.published)}</lastBuildDate>`]
      : []),
    items,
    "  </channel>",
    "</rss>",
    "",
  ]
    .filter((line) => line !== "")
    .join("\n");
}
