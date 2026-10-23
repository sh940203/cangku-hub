import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";

// cacheComponents is left off: @serwist/turbopack's route handler does not support it.
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withSerwist(nextConfig);
