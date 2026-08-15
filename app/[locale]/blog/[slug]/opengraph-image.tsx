import { ImageResponse } from "next/og";

import { getBlogAuthor } from "@/features/blog/authors";
import { getBlogPost } from "@/features/blog/registry";
import { BRAND_NAME } from "@/features/blog/site";
import { isLocale } from "@/lib/i18n/config";

// Sourced rather than inlined: a bare string literal here is indistinguishable
// from an un-localized JSX alt attribute to scripts/check-localization.mjs.
export const alt = BRAND_NAME;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Long titles need to shrink rather than overflow the card. */
function titleSize(title: string) {
  if (title.length > 90) return 46;
  if (title.length > 55) return 58;
  return 72;
}

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const post = isLocale(locale) ? getBlogPost(slug, locale) : undefined;
  const author = post ? getBlogAuthor(post.author) : undefined;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#f8f3ea",
        color: "#26352e",
        padding: "80px",
      }}
    >
      <div
        style={{
          display: "flex",
          fontSize: 34,
          letterSpacing: "0.28em",
          fontWeight: 700,
        }}
      >
        KINAVELA
      </div>
      <div
        style={{
          display: "flex",
          fontSize: titleSize(post?.title ?? ""),
          lineHeight: 1.14,
        }}
      >
        {post?.title ?? "Blog"}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "24px",
          fontSize: 30,
          color: "#6d746e",
        }}
      >
        <div
          style={{
            display: "flex",
            width: "72px",
            height: "8px",
            background: "#9f4334",
            borderRadius: "999px",
          }}
        />
        {author?.name ?? "kinavela.com"}
      </div>
    </div>,
    size,
  );
}
