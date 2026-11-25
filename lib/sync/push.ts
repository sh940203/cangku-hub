// Platform stock sync, by hand: we never call platform APIs. The user downloads the platform's current
// template, we fill in our sellable quantity where it changed, the user uploads it, and only after they
// confirm do we record last_pushed_stock.
import { and, asc, eq, like } from "drizzle-orm";
import type { Db } from "@/db";
import { type Platform, platformListings, products, skus, stockMovements } from "@/db/schema";
import { listingRef, productCodeOf } from "@/lib/catalog/import-listings";
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
  variantId: string | null;
  code: string;
  productName: string;
  variantName: string | null;
  isBundle: boolean;
  available: number;
  lastPushed: number | null;
};

/**
 * Every linked listing with its sellable quantity and the number last pushed. Listings imported before
 * last_pushed_stock was recorded fall back to the stock they were imported with (their `initial` movement),
 * which is what the platform had at that moment.
 */
async function listingStates(db: Db, platform: Platform): Promise<PendingPush[]> {
  const [rows, available, imported] = await Promise.all([
    db
      .select({
        skuId: skus.id,
        productId: skus.productId,
        variantId: platformListings.platformVariantId,
        code: skus.code,
        productName: products.name,
        variantName: skus.variantName,
        isBundle: skus.isBundle,
        lastPushed: platformListings.lastPushedStock,
      })
      .from(platformListings)
      .innerJoin(skus, eq(skus.id, platformListings.skuId))
      .innerJoin(products, eq(products.id, skus.productId))
      .where(eq(platformListings.platform, platform))
      .orderBy(asc(skus.code)),
    getAvailability(db),
    db
      .select({ refId: stockMovements.refId, delta: stockMovements.delta })
      .from(stockMovements)
      .where(
        and(
          eq(stockMovements.refType, "import_batch"),
          eq(stockMovements.reason, "initial"),
          like(stockMovements.refId, `${platform}:listing:%`),
        ),
      ),
  ]);
  const initial = new Map(imported.map((m) => [m.refId, m.delta]));
  return rows.map((r) => ({
    ...r,
    available: available.get(r.skuId) ?? 0,
    lastPushed: r.lastPushed ?? (r.variantId ? initial.get(listingRef(platform, r.variantId)) : undefined) ?? null,
  }));
}

/** Listings whose sellable quantity differs from what was last pushed (never pushed counts as different). */
export async function pendingPushes(db: Db, platform: Platform): Promise<PendingPush[]> {
  return (await listingStates(db, platform)).filter((r) => r.available !== r.lastPushed);
}

/**
 * variation ID → our codes for every linked variation asked for, plus our sellable quantity for the pending
 * ones only. Other rows keep the platform's own number: orders are not imported yet, so a sale on the
 * platform would be undone if we wrote back a quantity that has not changed on our side.
 */
export async function pushValues(db: Db, platform: Platform, variantIds: readonly string[]) {
  const wanted = new Set(variantIds);
  const out = new Map<string, { skuCode: string; productCode: string; stock?: number }>();
  for (const r of await listingStates(db, platform)) {
    if (!r.variantId || !wanted.has(r.variantId)) continue;
    out.set(r.variantId, {
      skuCode: r.code,
      productCode: productCodeOf(r.code),
      ...(r.available !== r.lastPushed ? { stock: r.available } : {}),
    });
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
