import { inArray } from "drizzle-orm";
import type { Db } from "@/db";
import { bundleComponents, skus } from "@/db/schema";
import { bundleAvailable, physicalAvailable } from "./available";

/** Sellable quantity per SKU id. Bundles are computed from their components' current stock. */
export async function getAvailability(db: Db, skuIds?: number[]): Promise<Map<number, number>> {
  const rows = await db.select({ id: skus.id, isBundle: skus.isBundle, stock: skus.stock }).from(skus);
  const stockById = new Map(rows.map((r) => [r.id, r.stock]));
  const wanted = skuIds ? rows.filter((r) => skuIds.includes(r.id)) : rows;

  const bundleIds = wanted.filter((r) => r.isBundle).map((r) => r.id);
  const links = bundleIds.length
    ? await db.select().from(bundleComponents).where(inArray(bundleComponents.bundleSkuId, bundleIds))
    : [];

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
