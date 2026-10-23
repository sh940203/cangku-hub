import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // keep the dev badge off the bottom tab bar
  devIndicators: { position: "top-right" },
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
