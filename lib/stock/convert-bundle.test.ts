import { eq } from "drizzle-orm";
import { afterEach, beforeEach, expect, it } from "vitest";
import type { Db } from "@/db";
import { bundleComponents, products, skus, stockMovements } from "@/db/schema";
import { createTestDb } from "@/lib/test/db";
import { convertToBundle } from "./convert-bundle";
import { recordMovement, StockError } from "./movements";
import { getAvailability } from "./queries";

let db: Db;
let cleanup: () => void;
let pid: number;
beforeEach(async () => {
  ({ db, cleanup } = await createTestDb());
  pid = (await db.insert(products).values({ name: "膠條" }).returning())[0].id;
});
afterEach(() => cleanup());

const mk = async (code: string, stock: number) => {
  const [s] = await db.insert(skus).values({ code, productId: pid, stock: 0, safetyStock: 2 }).returning();
  if (stock) await recordMovement(db, { skuId: s.id, delta: stock, reason: "initial", refType: "manual" });
  return s.id;
};

it("zeros stock with an adjust movement and becomes a bundle", async () => {
  const set = await mk("P0001", 3);
  const part = await mk("P0002", 5);
  expect(await convertToBundle(db, set)).toEqual({ cleared: 3 });
  const [row] = await db.select().from(skus).where(eq(skus.id, set));
  expect(row).toMatchObject({ isBundle: true, stock: null, safetyStock: null });
  const moves = await db.select().from(stockMovements).where(eq(stockMovements.skuId, set));
  expect(moves.reduce((n, m) => n + m.delta, 0)).toBe(0);
  expect(moves.at(-1)).toMatchObject({ reason: "adjust", delta: -3 });

  await db.insert(bundleComponents).values({ bundleSkuId: set, componentSkuId: part, qty: 2 });
  expect((await getAvailability(db, [set])).get(set)).toBe(2);
});

it("works with zero stock without writing a movement", async () => {
  const set = await mk("P0001", 0);
  expect(await convertToBundle(db, set)).toEqual({ cleared: 0 });
  expect(await db.select().from(stockMovements)).toHaveLength(0);
});

it("refuses bundles and SKUs used as components", async () => {
  const set = await mk("P0001", 0);
  const part = await mk("P0002", 1);
  await convertToBundle(db, set);
  await expect(convertToBundle(db, set)).rejects.toThrow(StockError);
  await db.insert(bundleComponents).values({ bundleSkuId: set, componentSkuId: part, qty: 1 });
  await expect(convertToBundle(db, part)).rejects.toThrow("部件");
});
