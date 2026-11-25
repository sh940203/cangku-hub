"use server";

import { refresh } from "next/cache";
import { getDb } from "@/db";
import { getAdapter } from "@/lib/platforms";
import { markPushed, pushValues } from "@/lib/sync/push";

const ID = /^\d+$/;

/** variation ID → codes and current sellable quantity to write into the template. */
export async function pushValuesAction(platform: string, variantIds: unknown) {
  const adapter = getAdapter(platform);
  if (!adapter?.listings || !Array.isArray(variantIds)) return {};
  const ids = variantIds.filter((v): v is string => typeof v === "string" && ID.test(v));
  return Object.fromEntries(await pushValues(getDb(), adapter.id, ids));
}

export async function markPushedAction(platform: string, entries: unknown): Promise<{ ok: boolean; error?: string }> {
  const adapter = getAdapter(platform);
  if (!adapter?.listings) return { ok: false, error: "這個平台不能更新庫存。" };
  if (
    !Array.isArray(entries) ||
    !entries.every(
      (e) => typeof e?.variantId === "string" && ID.test(e.variantId) && Number.isInteger(e.stock) && e.stock >= 0,
    )
  ) {
    return { ok: false, error: "資料格式不對，請重新產生檔案。" };
  }
  await markPushed(getDb(), adapter.id, entries);
  refresh();
  return { ok: true };
}
