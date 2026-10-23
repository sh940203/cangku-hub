import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/db";
import { bundleComponents, products, skus, stockMovements } from "@/db/schema";
import { createTestDb } from "@/lib/test/db";
import { adjustStock, recomputeStock, recordMovement, StockError } from "./movements";
import { getAvailability } from "./queries";

let db: Db;
let cleanup: () => void;

beforeEach(async () => {
  ({ db, cleanup } = await createTestDb());
});
afterEach(() => cleanup());

async function seedWeatherstrip() {
  const [product] = await db.insert(products).values({ name: "車門膠條" }).returning();
  const parts = await db
    .insert(skus)
    .values(
      ["前左", "前右", "後左", "後右"].map((v, i) => ({
        code: `WS-${i + 1}`,
        productId: product.id,
        variantName: v,
        stock: 0,
      })),
    )
    .returning();
  const [fullCar] = await db
    .insert(skus)
    .values({ code: "WS-SET", productId: product.id, variantName: "一車份", isBundle: true, stock: null })
    .returning();
  await db
    .insert(bundleComponents)
    .values(parts.map((p) => ({ bundleSkuId: fullCar.id, componentSkuId: p.id, qty: 1 })));
  return { parts, fullCar };
}

const stockOf = async (id: number) =>
  (await db.select({ stock: skus.stock }).from(skus).where(eq(skus.id, id)))[0].stock;

describe("recordMovement", () => {
  it("writes a movement and updates the cache", async () => {
    const { parts } = await seedWeatherstrip();
    const res = await recordMovement(db, { skuId: parts[0].id, delta: 5, reason: "initial", refType: "manual" });
    expect(res).toEqual({ status: "recorded", stock: 5 });
    expect(await stockOf(parts[0].id)).toBe(5);
    expect(await db.select().from(stockMovements)).toHaveLength(1);
  });

  it("ignores a repeated order reference so stock is deducted once", async () => {
    const { parts } = await seedWeatherstrip();
    await recordMovement(db, { skuId: parts[0].id, delta: 5, reason: "initial", refType: "manual" });
    const order = { skuId: parts[0].id, delta: -1, reason: "order", refType: "order_item", refId: "42" } as const;
    expect((await recordMovement(db, order)).status).toBe("recorded");
    expect(await recordMovement(db, order)).toEqual({ status: "duplicate" });
    expect(await stockOf(parts[0].id)).toBe(4);
  });

  it("refuses bundles", async () => {
    const { fullCar } = await seedWeatherstrip();
    await expect(
      recordMovement(db, { skuId: fullCar.id, delta: 1, reason: "restock", refType: "manual" }),
    ).rejects.toThrow(StockError);
    expect(await db.select().from(stockMovements)).toHaveLength(0);
  });

  it("refuses a zero or fractional delta", async () => {
    const { parts } = await seedWeatherstrip();
    for (const delta of [0, 1.5]) {
      await expect(
        recordMovement(db, { skuId: parts[0].id, delta, reason: "restock", refType: "manual" }),
      ).rejects.toThrow(StockError);
    }
  });
});

describe("adjustStock", () => {
  it("writes the difference as an adjust movement", async () => {
    const { parts } = await seedWeatherstrip();
    await recordMovement(db, { skuId: parts[0].id, delta: 5, reason: "initial", refType: "manual" });
    expect(await adjustStock(db, parts[0].id, 3)).toEqual({ delta: -2, stock: 3 });
    expect(await adjustStock(db, parts[0].id, 7)).toEqual({ delta: 4, stock: 7 });
    const adjusts = await db.select().from(stockMovements).where(eq(stockMovements.reason, "adjust"));
    expect(adjusts.map((m) => m.delta)).toEqual([-2, 4]);
    expect(await stockOf(parts[0].id)).toBe(7);
  });

  it("writes nothing when the count matches", async () => {
    const { parts } = await seedWeatherstrip();
    expect(await adjustStock(db, parts[0].id, 0)).toEqual({ delta: 0, stock: 0 });
    expect(await db.select().from(stockMovements)).toHaveLength(0);
  });

  it("rejects negative or fractional counts and bundles", async () => {
    const { parts, fullCar } = await seedWeatherstrip();
    await expect(adjustStock(db, parts[0].id, -1)).rejects.toThrow(StockError);
    await expect(adjustStock(db, parts[0].id, 2.5)).rejects.toThrow(StockError);
    await expect(adjustStock(db, fullCar.id, 3)).rejects.toThrow(StockError);
  });
});

describe("recomputeStock", () => {
  it("rebuilds the cache from movements", async () => {
    const { parts } = await seedWeatherstrip();
    await recordMovement(db, { skuId: parts[0].id, delta: 5, reason: "initial", refType: "manual" });
    await adjustStock(db, parts[0].id, 2);
    await db.update(skus).set({ stock: 99 }).where(eq(skus.id, parts[0].id)); // corrupt the cache
    expect(await recomputeStock(db, parts[0].id)).toBe(2);
    expect(await stockOf(parts[0].id)).toBe(2);
  });
});

describe("M1 acceptance: 一車份 follows its components", () => {
  it("changes when component stock is adjusted", async () => {
    const { parts, fullCar } = await seedWeatherstrip();
    const [fl, fr, rl, rr] = parts;
    for (const [sku, n] of [[fl, 5], [fr, 3], [rl, 2], [rr, 4]] as const) {
      await adjustStock(db, sku.id, n);
    }
    expect((await getAvailability(db)).get(fullCar.id)).toBe(2);

    await adjustStock(db, rl.id, 1);
    expect((await getAvailability(db)).get(fullCar.id)).toBe(1);

    await adjustStock(db, rl.id, 6);
    expect((await getAvailability(db)).get(fullCar.id)).toBe(3); // now 前右 is the limit

    const avail = await getAvailability(db, [fl.id, fullCar.id]);
    expect([...avail.entries()]).toEqual([
      [fl.id, 5],
      [fullCar.id, 3],
    ]);
  });
});
