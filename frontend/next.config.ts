import type { NextConfig } from "next";

// The browser only ever talks to this Next.js server. Requests to /api/* are
// proxied to the Express API, so the session cookie is first-party and
// httpOnly — no tokens in localStorage.
const API_URL = process.env.API_URL ?? "http://localhost:3000";

const nextConfig: NextConfig = {
  experimental: {
    agentFeedback: true,
    // The signed-in area renders after /api/me resolves (auth-gated, client
    // side), so only validate segments that opt in with `export const instant`.
    instantInsights: { validationLevel: "manual-warning" },
  },
  cacheComponents: true,
  partialPrefetching: true,
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_URL}/api/:path*` }];
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "img.youtube.com" }],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
