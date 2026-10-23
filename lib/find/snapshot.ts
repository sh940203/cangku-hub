import { asc, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { bundleComponents, locations, products, skus } from "@/db/schema";
import type { Snapshot, SnapshotSku } from "./types";

/** Everything the find page needs offline: SKUs, locations, stock and bundle parts. No customer data. */
export async function buildSnapshot(db: Db): Promise<Snapshot> {
  const [rows, links] = await Promise.all([
    db
      .select({
        id: skus.id,
        code: skus.code,
        barcode: skus.barcode,
        productName: products.name,
        variantName: skus.variantName,
        isBundle: skus.isBundle,
        status: skus.status,
        stock: skus.stock,
        safetyStock: skus.safetyStock,
        locationCode: locations.code,
      })
      .from(skus)
      .innerJoin(products, eq(products.id, skus.productId))
      .leftJoin(locations, eq(locations.id, skus.locationId))
      .orderBy(asc(products.name), asc(skus.code)),
    db.select().from(bundleComponents),
  ]);

  const byBundle = new Map<number, SnapshotSku["components"]>();
  for (const l of links) {
    const list = byBundle.get(l.bundleSkuId) ?? [];
    list.push({ skuId: l.componentSkuId, qty: l.qty });
    byBundle.set(l.bundleSkuId, list);
  }

  return {
    generatedAt: Date.now(),
    skus: rows.map(({ status, ...r }) => ({
      ...r,
      active: status === "active",
      components: r.isBundle ? (byBundle.get(r.id) ?? []) : [],
    })),
  };
}
