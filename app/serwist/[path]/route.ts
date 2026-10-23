import { createSerwistRoute } from "@serwist/turbopack";

// Serves the bundled service worker at /serwist/sw.js (prerendered at build time).
export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute({
  swSrc: "app/sw.ts",
  useNativeEsbuild: true,
  additionalPrecacheEntries: [{ url: "/~offline", revision: crypto.randomUUID() }],
});
