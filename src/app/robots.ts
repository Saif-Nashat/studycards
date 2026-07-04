import type { MetadataRoute } from "next";

// The only page an anonymous visitor can see is the login screen (the proxy
// redirects everything else there), so that's all we invite crawlers to index.
// AI-training scrapers are told to stay out entirely: study content is private
// and there's nothing public worth feeding a model.

const prodUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

const AI_SCRAPERS = [
  "GPTBot",
  "ChatGPT-User",
  "CCBot",
  "Google-Extended",
  "anthropic-ai",
  "ClaudeBot",
  "Claude-Web",
  "PerplexityBot",
  "Bytespider",
  "Applebot-Extended",
  "meta-externalagent",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Search engines: index the front door, skip API + private app pages
      // (they'd only get redirected to /login anyway).
      {
        userAgent: "*",
        allow: ["/$", "/login"],
        disallow: "/",
      },
      ...AI_SCRAPERS.map((bot) => ({ userAgent: bot, disallow: "/" })),
    ],
    sitemap: `${prodUrl}/sitemap.xml`,
  };
}
