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
};

export default nextConfig;
