// Platform stock sync, by hand: we never call platform APIs. The user downloads the platform's current
// template, we fill in our sellable quantity, the user uploads it, and only after they confirm do we
// record last_pushed_stock.
import { and, asc, eq, inArray } from "drizzle-orm";
import type { Db } from "@/db";
import { type Platform, platformListings, products, skus } from "@/db/schema";
import { productCodeOf } from "@/lib/catalog/import-listings";
import { getAvailability } from "@/lib/stock/queries";

const CHUNK = 400;
function chunks<T>(list: readonly T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += CHUNK) out.push(list.slice(i, i + CHUNK));
  return out;
}

export type PendingPush = {
  skuId: number;
  productId: number;
  code: string;
  productName: string;
  variantName: string | null;
  isBundle: boolean;
  available: number;
  lastPushed: number | null;
};

/** Listings whose sellable quantity differs from what was last pushed (never pushed counts as different). */
export async function pendingPushes(db: Db, platform: Platform): Promise<PendingPush[]> {
  const [rows, available] = await Promise.all([
    db
      .select({
        skuId: skus.id,
        productId: skus.productId,
        code: skus.code,
        productName: products.name,
        variantName: skus.variantName,
        isBundle: skus.isBundle,
        status: skus.status,
        lastPushed: platformListings.lastPushedStock,
      })
      .from(platformListings)
      .innerJoin(skus, eq(skus.id, platformListings.skuId))
      .innerJoin(products, eq(products.id, skus.productId))
      .where(eq(platformListings.platform, platform))
      .orderBy(asc(skus.code)),
    getAvailability(db),
  ]);
  return rows
    .map(({ status: _status, ...r }) => ({ ...r, available: available.get(r.skuId) ?? 0 }))
    .filter((r) => r.available !== r.lastPushed);
}

/** variation ID → our codes and current sellable quantity, for every linked variation asked for. */
export async function pushValues(db: Db, platform: Platform, variantIds: readonly string[]) {
  const out = new Map<string, { skuCode: string; productCode: string; stock: number }>();
  const available = await getAvailability(db);
  for (const part of chunks([...new Set(variantIds)])) {
    const rows = await db
      .select({ variantId: platformListings.platformVariantId, skuId: skus.id, code: skus.code })
      .from(platformListings)
      .innerJoin(skus, eq(skus.id, platformListings.skuId))
      .where(and(eq(platformListings.platform, platform), inArray(platformListings.platformVariantId, part)));
    for (const r of rows) {
      if (!r.variantId) continue;
      out.set(r.variantId, { skuCode: r.code, productCode: productCodeOf(r.code), stock: available.get(r.skuId) ?? 0 });
    }
  }
  return out;
}

/** After the user has uploaded the file: record the numbers that were in it. */
export async function markPushed(db: Db, platform: Platform, entries: readonly { variantId: string; stock: number }[]) {
  const now = new Date();
  for (const part of chunks(entries)) {
    const writes = part.map((e) =>
      db
        .update(platformListings)
        .set({ lastPushedStock: e.stock, lastPushedAt: now })
        .where(and(eq(platformListings.platform, platform), eq(platformListings.platformVariantId, e.variantId))),
    );
    if (writes.length) await db.batch([writes[0], ...writes.slice(1)]);
  }
}
