// Bundles app/sw.ts and injects the precache manifest into public/sw.js.
// Runs after `next build` so .next/static exists; OpenNext then copies public/ into the Worker assets.
import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";
import { injectManifest } from "@serwist/build";
import { build } from "esbuild";

const tmp = ".next/sw.bundle.js";

await build({
  entryPoints: ["app/sw.ts"],
  outfile: tmp,
  bundle: true,
  format: "iife",
  minify: true,
  target: "es2020",
  define: { "process.env.NODE_ENV": '"production"' },
  logLevel: "warning",
});

const { count, size, warnings } = await injectManifest({
  swSrc: tmp,
  swDest: "public/sw.js",
  globDirectory: ".",
  globPatterns: [".next/static/**/*.{js,css,woff2}", "public/**/*.{png,svg,ico,webmanifest}"],
  modifyURLPrefix: { ".next/static/": "/_next/static/", "public/": "/" },
  dontCacheBustURLsMatching: /^\/_next\/static\//,
  additionalPrecacheEntries: [{ url: "/~offline", revision: randomUUID() }],
});

rmSync(tmp);
for (const w of warnings) console.warn(w);
console.log(`sw.js: ${count} precache entries (${(size / 1024).toFixed(1)} KiB)`);
