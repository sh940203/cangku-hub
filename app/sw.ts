import { defaultCache } from "@serwist/turbopack/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { NetworkFirst, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const SNAPSHOT_CACHE = "snapshot";

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  // /find is precached once; /find?q=…&sku=… must hit the same entry when offline.
  precacheOptions: { ignoreURLParametersMatching: [/.*/] },
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      // Offline find: latest stock snapshot, falling back to the cached one when the network is slow or gone.
      matcher: ({ url, sameOrigin }) => sameOrigin && url.pathname === "/api/snapshot",
      handler: new NetworkFirst({ cacheName: SNAPSHOT_CACHE, networkTimeoutSeconds: 4 }),
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

// First install: the page's own snapshot fetch runs before this worker controls it, so grab one here.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SNAPSHOT_CACHE)
      .then((cache) => cache.add("/api/snapshot"))
      .catch(() => {}),
  );
});

serwist.addEventListeners();
