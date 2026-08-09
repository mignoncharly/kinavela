import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kinavela",
    short_name: "Kinavela",
    description:
      "Privacy-first cultural community infrastructure for diaspora families.",
    start_url: "/de",
    display: "standalone",
    background_color: "#f8f3ea",
    theme_color: "#f8f3ea",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
