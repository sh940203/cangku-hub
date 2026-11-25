"use server";

import { refresh } from "next/cache";
import { getDb } from "@/db";
import { importListings, type ListingImportSummary, listingCodes } from "@/lib/catalog/import-listings";
import { getAdapter } from "@/lib/platforms";
import type { ListingLine } from "@/lib/platforms/types";

export type ListingImportResult = { ok: true; summary: ListingImportSummary } | { ok: false; error: string };

const ID = /^\d+$/;
function isLine(v: unknown): v is ListingLine {
  const l = v as ListingLine;
  return (
    typeof l === "object" &&
    l !== null &&
    typeof l.itemId === "string" &&
    ID.test(l.itemId) &&
    typeof l.itemName === "string" &&
    typeof l.variantId === "string" &&
    ID.test(l.variantId) &&
    typeof l.variantName === "string" &&
    typeof l.skuCode === "string" &&
    Number.isInteger(l.stock) &&
    l.stock >= 0
  );
}

/** The browser sends whole products in parts; each call is safe to repeat. */
export async function importListingsAction(platform: string, lines: unknown): Promise<ListingImportResult> {
  const adapter = getAdapter(platform);
  if (!adapter?.listings) return { ok: false, error: "這個平台還不能匯入商品。" };
  if (!Array.isArray(lines) || lines.length === 0 || !lines.every(isLine)) {
    return { ok: false, error: "商品資料格式不對，請重新選擇檔案。" };
  }
  const clean = lines.map((l) => ({ ...l, itemName: l.itemName.slice(0, 300), variantName: l.variantName.slice(0, 200) }));
  const summary = await importListings(getDb(), { platform: adapter.id, lines: clean });
  refresh();
  return { ok: true, summary };
}

/** variation ID → our codes, for writing back into the platform template. */
export async function listingCodesAction(platform: string, variantIds: unknown) {
  const adapter = getAdapter(platform);
  if (!adapter?.listings || !Array.isArray(variantIds)) return {};
  const ids = variantIds.filter((v): v is string => typeof v === "string" && ID.test(v));
  const map = await listingCodes(getDb(), adapter.id, ids);
  return Object.fromEntries([...map].map(([k, v]) => [k, { skuCode: v.skuCode, productCode: v.productCode }]));
}
