// Turns a physical SKU into a bundle (e.g. an imported platform variation that is really a set of parts).
// Its stock is first zeroed by an `adjust` movement, so the ledger still explains every unit it ever held;
// after that it holds no stock and its sellable quantity comes from its components.
import { count, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { bundleComponents, skus } from "@/db/schema";
import { movementBatch, StockError } from "./movements";

export async function convertToBundle(db: Db, skuId: number): Promise<{ cleared: number }> {
  const [[sku], [used]] = await Promise.all([
    db.select({ isBundle: skus.isBundle, stock: skus.stock }).from(skus).where(eq(skus.id, skuId)),
    db.select({ n: count() }).from(bundleComponents).where(eq(bundleComponents.componentSkuId, skuId)),
  ]);
  if (!sku) throw new StockError("找不到這個貨號。");
  if (sku.isBundle) throw new StockError("這個貨號已經是組合。");
  if (used.n > 0) throw new StockError("這個貨號是其他組合的部件，不能改成組合。");
  const stock = sku.stock ?? 0;
  const clear = stock === 0 ? [] : movementBatch(db, [{ skuId, delta: -stock, reason: "adjust", refType: "manual", note: "改成組合，庫存歸零" }]);
  const flip = db
    .update(skus)
    .set({ isBundle: true, stock: null, safetyStock: null, locationId: null })
    .where(eq(skus.id, skuId));
  // Movement first (the SKU must still be physical when its cache is recomputed), then the flip.
  await (clear.length ? db.batch([clear[0], ...clear.slice(1), flip]) : flip);
  return { cleared: stock };
}
