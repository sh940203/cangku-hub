"use client";

import { useEffect } from "react";

// Fetch the find snapshot on every app load so the service worker has a fresh copy before signal drops.
export function SnapshotWarmer() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && navigator.onLine) {
      fetch("/api/snapshot").catch(() => {});
    }
  }, []);
  return null;
}
