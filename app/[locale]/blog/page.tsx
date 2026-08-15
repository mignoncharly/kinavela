import type { Metadata, ResolvingMetadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { fill } from "@/features/blog/copy";
import { blogIndexJsonLd, serializeJsonLd } from "@/features/blog/jsonld";
import { blogIndex, listBlogPosts } from "@/features/blog/registry";
import { getBlogAuthor } from "@/features/blog/authors";
import { isLocale, locales } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { formatDate, formatLanguage } from "@/lib/i18n/format";

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata(
  { params }: PageProps,
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dictionary = getDictionary(locale);
  // See app/[locale]/page.tsx — openGraph overwrites rather than merges.
  const parentImages = (await parent).openGraph?.images ?? [];
  return {
    title: dictionary.blog.metaTitle,
    description: dictionary.blog.metaDescription,
    alternates: {
      canonical: `/${locale}/blog`,
      languages: {
        ...Object.fromEntries(locales.map((item) => [item, `/${item}/blog`])),
        "x-default": "/de/blog",
      },
      types: {
        "application/rss+xml": [
          { url: `/${locale}/feed.xml`, title: dictionary.blog.metaTitle },
        ],
      },
    },
    openGraph: {
      type: "website",
      locale,
      url: `/${locale}/blog`,
      title: dictionary.blog.metaTitle,
      description: dictionary.blog.metaDescription,
      siteName: "Kinavela",
      images: parentImages,
    },
  };
}

export default async function BlogIndexPage({ params }: PageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dictionary = getDictionary(locale);
  const items = blogIndex(locale);
  const jsonLd = blogIndexJsonLd({
    locale,
    name: dictionary.blog.metaTitle,
    description: dictionary.blog.metaDescription,
    posts: listBlogPosts(locale),
  });

  return (
    <main className="blog-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <header className="blog-header">
        <Link
          className="brand"
          href={`/${locale}`}
          aria-label={dictionary.nav.homeLabel}
        >
          <span className="brand-mark" aria-hidden="true">
            K
          </span>
          <span>KINAVELA</span>
        </Link>
        <nav className="blog-nav" aria-label={dictionary.blog.navigationLabel}>
          <Link href={`/${locale}`}>{dictionary.blog.backHome}</Link>
          <Link href={`/${locale}/auth/login`}>{dictionary.nav.signIn}</Link>
        </nav>
        <nav
          className="locale-switcher"
          aria-label={dictionary.nav.languageLabel}
        >
          {locales.map((item) => (
            <Link
              key={item}
              href={`/${item}/blog`}
              hrefLang={item}
              aria-current={item === locale ? "page" : undefined}
            >
              {item.toUpperCase()}
            </Link>
          ))}
        </nav>
      </header>

      <div className="blog-intro">
        <p className="eyebrow">{dictionary.blog.eyebrow}</p>
        <h1>{dictionary.blog.title}</h1>
        <p className="blog-lead">{dictionary.blog.intro}</p>
      </div>

      {items.length === 0 ? (
        <p className="blog-empty">{dictionary.blog.empty}</p>
      ) : (
        <ul className="blog-list" aria-label={dictionary.blog.postsLabel}>
          {items.map(({ post, locale: postLocale, fallback }) => {
            const author = getBlogAuthor(post.author);
            return (
              <li className="blog-card" key={post.slug}>
                <p className="blog-card-meta">
                  <time dateTime={post.published}>
                    {formatDate(locale, post.published)}
                  </time>
                  <span aria-hidden="true">·</span>
                  <span>
                    {fill(dictionary.blog.readingTime, {
                      minutes: post.readingMinutes,
                    })}
                  </span>
                  {fallback && (
                    <span className="blog-badge">
                      {fill(dictionary.blog.onlyIn, {
                        language: formatLanguage(locale, postLocale),
                      })}
                    </span>
                  )}
                </p>
                <h2>
                  <Link href={`/${postLocale}/blog/${post.slug}`}>
                    {post.title}
                  </Link>
                </h2>
                <p className="blog-card-excerpt">{post.excerpt}</p>
                {author && (
                  <p className="blog-card-author">
                    {dictionary.blog.by} {author.name}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <footer className="blog-footer">
        <span>© {new Date().getUTCFullYear()} Kinavela</span>
        <nav aria-label={dictionary.footer.legalLabel}>
          <Link href={`/${locale}/privacy`}>{dictionary.footer.privacy}</Link>
          <Link href={`/${locale}/impressum`}>
            {dictionary.footer.impressum}
          </Link>
        </nav>
      </footer>
    </main>
  );
}
