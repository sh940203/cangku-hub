// The only place that changes stock. Every change writes stock_movements rows and then recomputes the
// skus.stock cache from those rows, in one atomic batch. Batches (not interactive transactions) keep
// each write to a single round trip to Turso.
import { eq, sql } from "drizzle-orm";
import type { Db } from "@/db";
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

function checkDelta(delta: number) {
  if (!Number.isInteger(delta) || delta === 0) throw new StockError(`invalid delta: ${delta}`);
}

async function physicalSku(db: Db, skuId: number) {
  const [sku] = await db
    .select({ id: skus.id, isBundle: skus.isBundle, stock: skus.stock })
    .from(skus)
    .where(eq(skus.id, skuId));
  if (!sku) throw new StockError(`SKU ${skuId} 不存在`);
  if (sku.isBundle) throw new StockError("組合商品沒有自己的庫存，請改動部件");
  return sku;
}

const insertMovement = (db: Db, m: MovementInput) =>
  db
    .insert(stockMovements)
    .values({ skuId: m.skuId, delta: m.delta, reason: m.reason, refType: m.refType, refId: m.refId ?? null, note: m.note ?? null })
    .onConflictDoNothing();

/** skus.stock := sum of the SKU's movements. `skuId` may be a number or a SQL subquery. */
const recompute = (db: Db, skuId: number | ReturnType<typeof sql>) =>
  db
    .update(skus)
    .set({ stock: sql`(select coalesce(sum(${stockMovements.delta}), 0) from ${stockMovements} where ${stockMovements.skuId} = ${skuId})` })
    .where(eq(skus.id, skuId))
    .returning({ stock: skus.stock });

/** Records one movement: one read to validate the SKU, one atomic batch to write. */
export async function recordMovement(db: Db, input: MovementInput): Promise<MovementResult> {
  checkDelta(input.delta);
  await physicalSku(db, input.skuId);
  const [inserted, [updated]] = await db.batch([
    insertMovement(db, input).returning({ id: stockMovements.id }),
    recompute(db, input.skuId),
  ]);
  if (inserted.length === 0) return { status: "duplicate" };
  return { status: "recorded", stock: updated.stock ?? 0 };
}

/**
 * Batch statements for many movements at once (order import). Duplicate inserts are skipped via the
 * unique ref index, then each touched SKU's cache is recomputed from its movements, so the cache can never
 * drift. Callers must only pass physical SKUs.
 */
export function movementBatch(db: Db, inputs: readonly MovementInput[]) {
  inputs.forEach((m) => checkDelta(m.delta));
  return [
    ...inputs.map((m) => insertMovement(db, m)),
    ...[...new Set(inputs.map((m) => m.skuId))].map((skuId) => recompute(db, skuId)),
  ];
}

/**
 * Initial stock for a SKU created in the same batch, addressed by its code (its id is not known yet).
 * Put these after the SKU insert.
 */
export function initialStockBatch(db: Db, skuCode: string, qty: number) {
  checkDelta(qty);
  const id = sql`(select ${skus.id} from ${skus} where ${skus.code} = ${skuCode})`;
  return [
    db.insert(stockMovements).values({ skuId: id, delta: qty, reason: "initial", refType: "manual" }),
    recompute(db, id),
  ];
}

export type AdjustResult = { delta: number; stock: number };

/** Stocktake: sets stock to the counted quantity by writing an `adjust` movement for the difference. */
export async function adjustStock(db: Db, skuId: number, counted: number, note?: string | null): Promise<AdjustResult> {
  if (!Number.isInteger(counted) || counted < 0) {
    throw new StockError("實際數量要是 0 以上的整數");
  }
  const sku = await physicalSku(db, skuId);
  const current = sku.stock ?? 0;
  const delta = counted - current;
  if (delta === 0) return { delta: 0, stock: current };
  const [, [updated]] = await db.batch([
    insertMovement(db, { skuId, delta, reason: "adjust", refType: "manual", note }),
    recompute(db, skuId),
  ]);
  return { delta, stock: updated.stock ?? counted };
}

/** Rebuilds the skus.stock cache from stock_movements. Returns the recomputed value. */
export async function recomputeStock(db: Db, skuId: number): Promise<number> {
  await physicalSku(db, skuId);
  const [updated] = await recompute(db, skuId);
  return updated.stock ?? 0;
}
