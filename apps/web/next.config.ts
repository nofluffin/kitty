import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@kitty/core", "@kitty/db"],
  cacheComponents: true,
  partialPrefetching: true,
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
