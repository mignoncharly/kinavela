import type { MetadataRoute } from "next";

const baseUrl = "https://www.kinavela.com";

// Member-facing surfaces. Nothing behind these prefixes should ever reach an
// index: they are either authenticated, single-use, or personal.
const privatePaths = [
  "/api/",
  "/*/app",
  "/*/onboarding",
  "/*/auth",
  "/*/invite",
  "/*/suspended",
  "/*/stories/record",
  "/auth/",
  "/offline",
];

const publicPaths = ["/de", "/fr", "/en"];

// Retrieval crawlers: these are what let an assistant cite kinavela.com when a
// user asks it a question. They are distinct from the training crawlers below.
const assistantSearchBots = [
  "OAI-SearchBot", // ChatGPT search
  "ChatGPT-User", // ChatGPT browsing a link on a user's behalf
  "PerplexityBot",
  "Perplexity-User",
  "Claude-User",
  "Claude-SearchBot",
  "DuckAssistBot",
  "Applebot", // Siri / Spotlight
  "Amazonbot",
];

// Model-training crawlers. Allowed today because broad corpus presence helps
// assistants know the brand exists at all; flip to `disallow` to opt out of
// training without losing the retrieval bots above.
const modelTrainingBots = [
  "GPTBot",
  "ClaudeBot",
  "anthropic-ai",
  "Google-Extended", // Gemini grounding only — does not affect Google Search
  "Applebot-Extended",
  "meta-externalagent",
  "CCBot", // Common Crawl, feeds many downstream models
  "cohere-ai",
];

export default function robots(): MetadataRoute.Robots {
  // Each User-Agent block must repeat the disallow list: a crawler that finds a
  // block naming it ignores the "*" block entirely, so omitting these here
  // would silently expose the member area to every bot listed above.
  const rule = (userAgent: string | string[]) => ({
    userAgent,
    allow: publicPaths,
    disallow: privatePaths,
  });

  return {
    rules: [
      rule("*"),
      rule(assistantSearchBots),
      rule(modelTrainingBots),
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
