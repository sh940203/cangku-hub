import type { Db } from "@/db";
import { bundleComponents, skus } from "@/db/schema";
import { bundleAvailable, physicalAvailable } from "./available";

/** Sellable quantity per SKU id. Bundles are computed from their components' current stock. */
export async function getAvailability(db: Db, skuIds?: number[]): Promise<Map<number, number>> {
  // Two small reads in parallel: one round trip to Turso instead of two.
  const [rows, links] = await Promise.all([
    db.select({ id: skus.id, isBundle: skus.isBundle, stock: skus.stock }).from(skus),
    db.select().from(bundleComponents),
  ]);
  const stockById = new Map(rows.map((r) => [r.id, r.stock]));
  const wanted = skuIds ? rows.filter((r) => skuIds.includes(r.id)) : rows;

  const result = new Map<number, number>();
  for (const r of wanted) {
    if (!r.isBundle) {
      result.set(r.id, physicalAvailable(r.stock));
      continue;
    }
    const parts = links
      .filter((l) => l.bundleSkuId === r.id)
      .map((l) => ({ stock: stockById.get(l.componentSkuId) ?? 0, qty: l.qty }));
    result.set(r.id, bundleAvailable(parts));
  }
  return result;
}
