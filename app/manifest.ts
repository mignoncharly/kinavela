import type { MetadataRoute } from "next";

import { getDictionary } from "@/lib/i18n/dictionaries";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kinavela",
    short_name: "Kinavela",
    description: getDictionary("de").meta.description,
    start_url: "/de",
    id: "/de",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    lang: "de",
    categories: ["lifestyle", "social"],
    background_color: "#f8f3ea",
    theme_color: "#f8f3ea",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
