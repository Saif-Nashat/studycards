import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // This app uses a proxy (proxy.ts) for login. When a proxy is present,
    // Next.js buffers each request body in memory and — by default — caps it
    // at 10MB, silently truncating anything larger. Note this only governs the
    // Next server itself (local dev / self-hosting): Vercel rejects bodies
    // over ~4.5MB at the platform level regardless, which is why .apkg decks
    // are parsed in the browser and uploaded in small batches (see
    // src/lib/apkgClient.ts). Kept above the 10MB text-import cap so a maximal
    // paste still gets the route's friendly error instead of a truncated body.
    proxyClientMaxBodySize: "16mb",
  },

  // Baseline security headers for every response.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Browsers must not second-guess declared content types.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // The app has no reason to ever be embedded in a frame (clickjacking).
          { key: "X-Frame-Options", value: "DENY" },
          // Don't leak URLs to other origins.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // The app never uses these device APIs.
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
