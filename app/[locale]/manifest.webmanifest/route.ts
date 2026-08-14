import { NextResponse } from "next/server";

import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale } from "@/lib/i18n/config";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale } = await params;
  const selectedLocale = isLocale(locale) ? locale : "de";
  const dictionary = getDictionary(selectedLocale);
  return NextResponse.json(
    {
      name: "Kinavela",
      short_name: "Kinavela",
      description: dictionary.meta.description,
      start_url: `/${selectedLocale}`,
      id: `/${selectedLocale}`,
      scope: "/",
      display: "standalone",
      orientation: "portrait-primary",
      lang: selectedLocale,
      categories: ["lifestyle", "social"],
      background_color: "#f8f3ea",
      theme_color: "#f8f3ea",
      icons: [
        {
          src: "/icon.svg",
          sizes: "any",
          type: "image/svg+xml",
          purpose: "any",
        },
      ],
    },
    {
      headers: {
        "Content-Type": "application/manifest+json; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    },
  );
}
