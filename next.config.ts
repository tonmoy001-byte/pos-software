import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache static assets (including service worker) so they work offline.
  // sw.js and manifest.json are never revalidated — a versioned filename
  // (e.g. sw-v2.js) plus a page reload are both required for updates.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=3600",
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
            value: "public, max-age=86400, stale-while-revalidate=3600",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
