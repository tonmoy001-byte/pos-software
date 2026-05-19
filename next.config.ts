import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output for Docker/production deployments
  output: "standalone",

  // Cache static assets (including service worker) so they work offline.
  // Reduced cache time to 1 hour to allow faster SW updates (was 24h).
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600, stale-while-revalidate=300",
          },
          {
            key: "Service-Worker-Allowed",
            value: "/",
          },
        ],
      },
      {
        source: "/manifest.json",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600, stale-while-revalidate=300",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
