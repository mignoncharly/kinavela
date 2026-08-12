import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/de", "/fr", "/en"],
        disallow: ["/api/", "/*/app", "/*/onboarding", "/*/auth"],
      },
    ],
    sitemap: "https://www.kinavela.com/sitemap.xml",
  };
}
