import type { Platform } from "@/db/schema";
import { shopee } from "./shopee";
import type { PlatformAdapter } from "./types";

// Ruten, Yahoo and Coupang adapters come after the MVP.
export const adapters: Partial<Record<Platform, PlatformAdapter>> = { shopee };

export function getAdapter(id: string): PlatformAdapter | undefined {
  return adapters[id as Platform];
}
