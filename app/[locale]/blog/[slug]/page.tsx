import type { Metadata, ResolvingMetadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getBlogAuthor } from "@/features/blog/authors";
import { fill } from "@/features/blog/copy";
import { blogPostJsonLd, serializeJsonLd } from "@/features/blog/jsonld";
import {
  getPublicCommunityPage,
  localizedCommunityTitle,
} from "@/features/seo/public-pages";
import { blogPostLocales, getBlogPost } from "@/features/blog/registry";
import { blogPostLanguageAlternates } from "@/features/blog/seo";
import { isLocale, locales } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { formatDate, formatLanguage } from "@/lib/i18n/format";

type PageProps = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata(
  { params }: PageProps,
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const post = getBlogPost(slug, locale);
  if (!post) return {};
  const available = blogPostLocales(slug);
  const parentImages = (await parent).openGraph?.images ?? [];

  return {
    title: post.title,
    description: post.excerpt,
    alternates: {
      canonical: `/${locale}/blog/${slug}`,
      languages: blogPostLanguageAlternates(
        slug,
        available,
        post.originalLocale,
      ),
    },
    openGraph: {
      type: "article",
      locale,
      url: `/${locale}/blog/${slug}`,
      title: post.title,
      description: post.excerpt,
      siteName: "Kinavela",
      publishedTime: post.published,
      modifiedTime: post.updated ?? post.published,
      images: parentImages,
    },
  };
}

export default async function BlogPostPage({ params }: PageProps) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const post = getBlogPost(slug, locale);
  if (!post) notFound();

  const dictionary = getDictionary(locale);
  const author = getBlogAuthor(post.author);
  const otherLocales = blogPostLocales(slug).filter((item) => item !== locale);
  const community = post.community
    ? getPublicCommunityPage(post.community)
    : undefined;
  const jsonLd = blogPostJsonLd({ post, author, locale });

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
          <Link href={`/${locale}/blog`}>{dictionary.blog.allPosts}</Link>
          <Link href={`/${locale}`}>{dictionary.blog.backHome}</Link>
        </nav>
        {otherLocales.length > 0 && (
          <nav
            className="locale-switcher"
            aria-label={dictionary.nav.languageLabel}
          >
            {locales
              .filter((item) => item === locale || otherLocales.includes(item))
              .map((item) => (
                <Link
                  key={item}
                  href={`/${item}/blog/${slug}`}
                  hrefLang={item}
                  aria-current={item === locale ? "page" : undefined}
                >
                  {item.toUpperCase()}
                </Link>
              ))}
          </nav>
        )}
      </header>

      <article className="blog-article">
        <p className="blog-article-meta">
          <time dateTime={post.published}>
            {dictionary.blog.publishedOn} {formatDate(locale, post.published)}
          </time>
          <span aria-hidden="true">·</span>
          <span>
            {fill(dictionary.blog.readingTime, {
              minutes: post.readingMinutes,
            })}
          </span>
        </p>

        <h1>{post.title}</h1>
        <p className="blog-article-lead">{post.excerpt}</p>

        {author && (
          <p className="blog-byline">
            <span className="blog-byline-name">
              {dictionary.blog.by} {author.name}
            </span>
            <span className="blog-byline-role">{author.role[locale]}</span>
          </p>
        )}

        {post.translated && (
          <p className="blog-translation-note">
            {post.translator
              ? fill(dictionary.blog.translatedBy, {
                  translator: post.translator,
                })
              : fill(dictionary.blog.onlyIn, {
                  language: formatLanguage(locale, post.originalLocale),
                })}{" "}
            <Link href={`/${post.originalLocale}/blog/${slug}`}>
              {dictionary.blog.readOriginal}
            </Link>
          </p>
        )}

        {/* Body HTML comes from features/blog/markdown.ts, whose renderer has
            no code path that emits raw HTML or an out-of-allowlist URL. */}
        <div
          className="blog-body"
          dangerouslySetInnerHTML={{ __html: post.html }}
        />

        {post.updated && (
          <p className="blog-updated">
            <time dateTime={post.updated}>
              {dictionary.blog.updatedOn} {formatDate(locale, post.updated)}
            </time>
          </p>
        )}

        {community && (
          <aside className="blog-community-link">
            <Link href={`/${locale}/community/${community.slug}`}>
              {localizedCommunityTitle(community, locale)}
            </Link>
          </aside>
        )}

        {author && (
          <aside className="blog-author-card">
            <p className="eyebrow">{dictionary.blog.aboutAuthor}</p>
            <p className="blog-author-name">{author.name}</p>
            <p className="blog-author-bio">{author.bio[locale]}</p>
          </aside>
        )}

        <Link className="blog-back" href={`/${locale}/blog`}>
          {dictionary.blog.allPosts}
        </Link>
      </article>

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
