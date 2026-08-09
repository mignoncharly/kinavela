import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/de", "/fr", "/en"],
        disallow: ["/api/", "/admin/", "/app/"],
      },
    ],
    sitemap: "https://kinavela.gestionatech.de/sitemap.xml",
  };
}
