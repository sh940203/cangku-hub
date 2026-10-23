// The only place that changes stock. Every change writes a stock_movements row and
// updates the skus.stock cache in the same transaction.
import { eq, sql } from "drizzle-orm";
import type { Db, Tx } from "@/db";
import { MOVEMENT_REASONS, MOVEMENT_REF_TYPES, skus, stockMovements } from "@/db/schema";

export type MovementInput = {
  skuId: number;
  delta: number;
  reason: (typeof MOVEMENT_REASONS)[number];
  refType: (typeof MOVEMENT_REF_TYPES)[number];
  refId?: string | null;
  note?: string | null;
};

export type MovementResult =
  | { status: "recorded"; stock: number }
  // Same (ref_type, ref_id, sku_id, reason) already recorded, e.g. an order imported twice.
  | { status: "duplicate" };

export class StockError extends Error {}

async function physicalSku(tx: Tx, skuId: number) {
  const [sku] = await tx
    .select({ id: skus.id, isBundle: skus.isBundle, stock: skus.stock })
    .from(skus)
    .where(eq(skus.id, skuId));
  if (!sku) throw new StockError(`SKU ${skuId} 不存在`);
  if (sku.isBundle) throw new StockError("組合商品沒有自己的庫存，請改動部件");
  return sku;
}

async function recordIn(tx: Tx, input: MovementInput): Promise<MovementResult> {
  if (!Number.isInteger(input.delta) || input.delta === 0) {
    throw new StockError(`invalid delta: ${input.delta}`);
  }
  await physicalSku(tx, input.skuId);
  const inserted = await tx
    .insert(stockMovements)
    .values({
      skuId: input.skuId,
      delta: input.delta,
      reason: input.reason,
      refType: input.refType,
      refId: input.refId ?? null,
      note: input.note ?? null,
    })
    .onConflictDoNothing()
    .returning({ id: stockMovements.id });
  if (inserted.length === 0) return { status: "duplicate" };

  const [updated] = await tx
    .update(skus)
    .set({ stock: sql`coalesce(${skus.stock}, 0) + ${input.delta}` })
    .where(eq(skus.id, input.skuId))
    .returning({ stock: skus.stock });
  return { status: "recorded", stock: updated.stock ?? 0 };
}

/** Records one movement. Inside an outer transaction this becomes a savepoint. */
export async function recordMovement(db: Db | Tx, input: MovementInput): Promise<MovementResult> {
  return db.transaction((tx) => recordIn(tx, input));
}

export type AdjustResult = { delta: number; stock: number };

/** Stocktake: sets stock to the counted quantity by writing an `adjust` movement for the difference. */
export async function adjustStock(
  db: Db,
  skuId: number,
  counted: number,
  note?: string | null,
): Promise<AdjustResult> {
  if (!Number.isInteger(counted) || counted < 0) {
    throw new StockError("實際數量要是 0 以上的整數");
  }
  return db.transaction(async (tx) => {
    const sku = await physicalSku(tx, skuId);
    const current = sku.stock ?? 0;
    const delta = counted - current;
    if (delta === 0) return { delta: 0, stock: current };
    await recordIn(tx, { skuId, delta, reason: "adjust", refType: "manual", note });
    return { delta, stock: counted };
  });
}

/** Rebuilds the skus.stock cache from stock_movements. Returns the recomputed value. */
export async function recomputeStock(db: Db, skuId: number): Promise<number> {
  return db.transaction(async (tx) => {
    await physicalSku(tx, skuId);
    const [row] = await tx
      .select({ total: sql<number>`coalesce(sum(${stockMovements.delta}), 0)` })
      .from(stockMovements)
      .where(eq(stockMovements.skuId, skuId));
    const total = Number(row.total);
    await tx.update(skus).set({ stock: total }).where(eq(skus.id, skuId));
    return total;
  });
}
