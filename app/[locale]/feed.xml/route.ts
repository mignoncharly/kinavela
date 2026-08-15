import { renderBlogFeed } from "@/features/blog/feed";
import { listBlogPosts } from "@/features/blog/registry";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    return new Response(null, { status: 404 });
  }

  const dictionary = getDictionary(locale);
  const body = renderBlogFeed({
    locale,
    title: `${dictionary.blog.metaTitle} · Kinavela`,
    description: dictionary.blog.metaDescription,
    posts: listBlogPosts(locale),
  });

  return new Response(body, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      // Readers poll far more often than the blog changes, and the origin has
      // no HTTP cache in front of it (see docs/blog-implementation-plan.md).
      "Cache-Control": "public, max-age=600, s-maxage=3600",
    },
  });
}
