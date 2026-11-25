import { eq } from "drizzle-orm";
import { afterEach, beforeEach, expect, it } from "vitest";
import type { Db } from "@/db";
import { bundleComponents, platformListings, skus } from "@/db/schema";
import { importListings } from "@/lib/catalog/import-listings";
import type { ListingLine } from "@/lib/platforms/types";
import { convertToBundle } from "@/lib/stock/convert-bundle";
import { recordMovement } from "@/lib/stock/movements";
import { createTestDb } from "@/lib/test/db";
import { markPushed, pendingPushes, pushValues } from "./push";

let db: Db;
let cleanup: () => void;
const id: Record<string, number> = {};

// 膠條 with four parts and a 一車份 variation, as it would come from Shopee.
beforeEach(async () => {
  ({ db, cleanup } = await createTestDb());
  const v = (variantId: string, variantName: string, stock: number): ListingLine => ({
    itemId: "11", itemName: "膠條", variantId, variantName, skuCode: "", stock,
  });
  await importListings(db, {
    platform: "shopee",
    lines: [v("1", "前左", 5), v("2", "前右", 3), v("3", "後左", 2), v("4", "後右", 4), v("5", "一車份", 2)],
  });
  for (const s of await db.select().from(skus)) id[s.variantName!] = s.id;
  await convertToBundle(db, id["一車份"]);
  await db.insert(bundleComponents).values(
    ["前左", "前右", "後左", "後右"].map((n) => ({ bundleSkuId: id["一車份"], componentSkuId: id[n], qty: 1 })),
  );
});
afterEach(() => cleanup());

it("nothing pending right after import when numbers match", async () => {
  expect(await pendingPushes(db, "shopee")).toEqual([]);
});

it("MVP loop: selling a part lowers the bundle, both get pushed, then nothing is pending", async () => {
  await recordMovement(db, { skuId: id["後左"], delta: -1, reason: "order", refType: "manual" });
  const pending = await pendingPushes(db, "shopee");
  expect(pending.map((p) => [p.variantName, p.lastPushed, p.available])).toEqual([
    ["後左", 2, 1],
    ["一車份", 2, 1],
  ]);

  const values = await pushValues(db, "shopee", ["1", "3", "5", "999"]);
  expect(values.get("3")).toEqual({ skuCode: "P0001-03", productCode: "P0001", stock: 1 });
  expect(values.get("5")).toEqual({ skuCode: "P0001-05", productCode: "P0001", stock: 1 });
  // unchanged on our side: codes only, the platform keeps its own number (it may have sold some)
  expect(values.get("1")).toEqual({ skuCode: "P0001-01", productCode: "P0001" });
  expect(values.has("999")).toBe(false);

  await markPushed(
    db,
    "shopee",
    [...values].flatMap(([variantId, v]) => (v.stock === undefined ? [] : [{ variantId, stock: v.stock }])),
  );
  expect(await pendingPushes(db, "shopee")).toEqual([]);
});

it("listings imported before last_pushed_stock was recorded fall back to their imported stock", async () => {
  await db.update(platformListings).set({ lastPushedStock: null });
  expect(await pendingPushes(db, "shopee")).toEqual([]);
  await recordMovement(db, { skuId: id["前左"], delta: -1, reason: "order", refType: "manual" });
  expect((await pendingPushes(db, "shopee")).map((p) => [p.variantName, p.lastPushed, p.available])).toEqual([
    ["前左", 5, 4],
  ]);
});

it("oversold stock is pushed as 0", async () => {
  await recordMovement(db, { skuId: id["前右"], delta: -5, reason: "order", refType: "manual" });
  expect((await db.select().from(skus).where(eq(skus.id, id["前右"])))[0].stock).toBe(-2);
  expect((await pushValues(db, "shopee", ["2"])).get("2")?.stock).toBe(0);
});
