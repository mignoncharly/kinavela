import type { Locale } from "@/lib/i18n/config";
import { ORGANIZATION_ID, WEBSITE_ID, absoluteUrl } from "./site";
import type { BlogAuthor, BlogPost } from "./types";

/**
 * Structured data for the blog. Every node references the `@id`s the homepage
 * already publishes rather than redeclaring the organisation and website — a
 * second, slightly different Organization node would split the entity Google
 * is being asked to recognise, which is the opposite of the point.
 */

/** Google truncates headlines past ~110 characters in rich results. */
const HEADLINE_LIMIT = 110;

export function blogAuthorId(authorKey: string) {
  return `${absoluteUrl("/")}#person-${authorKey}`;
}

export function blogId(locale: Locale) {
  return `${absoluteUrl(`/${locale}/blog`)}#blog`;
}

function personNode(author: BlogAuthor, locale: Locale) {
  return {
    "@type": "Person",
    "@id": blogAuthorId(author.key),
    name: author.name,
    jobTitle: author.role[locale],
    description: author.bio[locale],
    ...(author.image ? { image: absoluteUrl(author.image) } : {}),
    ...(author.sameAs.length > 0 ? { sameAs: author.sameAs } : {}),
  };
}

export function blogPostJsonLd({
  post,
  author,
  locale,
}: {
  post: BlogPost;
  author: BlogAuthor | undefined;
  locale: Locale;
}) {
  const path = `/${locale}/blog/${post.slug}`;
  const url = absoluteUrl(path);
  const blogPath = `/${locale}/blog`;

  const article: Record<string, unknown> = {
    "@type": "BlogPosting",
    "@id": `${url}#article`,
    url,
    mainEntityOfPage: { "@id": `${url}#webpage` },
    headline: post.title.slice(0, HEADLINE_LIMIT),
    description: post.excerpt,
    inLanguage: locale,
    datePublished: post.published,
    dateModified: post.updated ?? post.published,
    isPartOf: { "@id": blogId(locale) },
    publisher: { "@id": ORGANIZATION_ID },
    image: absoluteUrl(`${path}/opengraph-image`),
  };

  if (author) article.author = { "@id": blogAuthorId(author.key) };
  if (post.tags.length > 0) article.keywords = post.tags.join(", ");
  // Declaring the translator is the structured-data half of saying so in the
  // page: a translation that hides its provenance is the thing to avoid.
  if (post.translator) {
    article.translator = { "@type": "Person", name: post.translator };
  }
  if (post.community) {
    article.mentions = {
      "@id": `${absoluteUrl(`/${locale}/community/${post.community}`)}#webpage`,
    };
  }

  const graph: Record<string, unknown>[] = [
    {
      "@type": "WebPage",
      "@id": `${url}#webpage`,
      url,
      name: post.title,
      inLanguage: locale,
      isPartOf: { "@id": WEBSITE_ID },
      publisher: { "@id": ORGANIZATION_ID },
    },
    article,
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Kinavela",
          item: absoluteUrl(`/${locale}`),
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Blog",
          item: absoluteUrl(blogPath),
        },
        { "@type": "ListItem", position: 3, name: post.title, item: url },
      ],
    },
  ];

  if (author) graph.push(personNode(author, locale));

  return { "@context": "https://schema.org", "@graph": graph };
}

export function blogIndexJsonLd({
  locale,
  name,
  description,
  posts,
}: {
  locale: Locale;
  name: string;
  description: string;
  posts: BlogPost[];
}) {
  const url = absoluteUrl(`/${locale}/blog`);

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Blog",
        "@id": blogId(locale),
        url,
        name,
        description,
        inLanguage: locale,
        isPartOf: { "@id": WEBSITE_ID },
        publisher: { "@id": ORGANIZATION_ID },
        // References only — each post's own page carries the full node, and
        // repeating the fields here would risk the two drifting apart.
        blogPost: posts.map((post) => ({
          "@id": `${absoluteUrl(`/${post.locale}/blog/${post.slug}`)}#article`,
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Kinavela",
            item: absoluteUrl(`/${locale}`),
          },
          { "@type": "ListItem", position: 2, name: "Blog", item: url },
        ],
      },
    ],
  };
}

/**
 * JSON-LD is injected with dangerouslySetInnerHTML, so `<` must be escaped:
 * a title containing `</script>` would otherwise close the tag early.
 */
export function serializeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
