import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Deal Book's template PDF and fonts are read from disk at request time.
  outputFileTracingIncludes: {
    '/api/deal-book': ['./src/lib/deal-book-assets/**'],
  },
  experimental: {
    // Client router cache: re-visiting a page within 30s renders instantly
    // from cache (no skeleton, no server round-trip). Fresh data still loads
    // on mutation via router.refresh() and on hard reloads.
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
};

export default nextConfig;
