import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for Docker production image
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // Allow image optimization for external sources if needed
  images: {
    domains: [],
  },
  async rewrites() {
    if (process.env.NODE_ENV !== "development") {
      return [];
    }
    return [
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:8000/api/:path*",
      },
      {
        source: "/health/:path*",
        destination: "http://127.0.0.1:8000/health/:path*",
      },
    ];
  },
};

export default nextConfig;
