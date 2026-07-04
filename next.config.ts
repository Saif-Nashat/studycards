import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // This app uses a proxy (proxy.ts) for login. When a proxy is present,
    // Next.js buffers each request body in memory and — by default — caps it at
    // 10MB, silently truncating anything larger. Real Anki decks (.apkg) bundle
    // their images and routinely run 100MB+, so without this the upload arrives
    // corrupted (the zip's index lives at the END of the file) and never imports.
    proxyClientMaxBodySize: "500mb",
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
