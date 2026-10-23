"use client";

import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

// design.md §10. Writes are not queued offline yet, so the banner says only lookups work.
export function OfflineBanner() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  if (online) return null;
  return (
    <div
      role="status"
      className="sticky top-0 z-20 bg-warn-bg px-4 py-1.5 pt-[max(0.375rem,env(safe-area-inset-top))] text-center text-aux text-warn lg:ml-52 print:hidden"
    >
      離線中，可以找貨；新增、盤點等變更請連上網路再做。
    </div>
  );
}
