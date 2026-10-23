import { eq, sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/db";
import { bundleComponents, orderItems, orders, products, skus, stockMovements } from "@/db/schema";
import { PiiError } from "@/lib/pii";
import type { ParsedOrderLine } from "@/lib/platforms/types";
import { recordMovement } from "@/lib/stock/movements";
import { getAvailability } from "@/lib/stock/queries";
import { createTestDb } from "@/lib/test/db";
import { importOrders, mapOrderItem } from "./import";

let db: Db;
let cleanup: () => void;
let ids: Record<"FL" | "FR" | "RL" | "RR" | "SET" | "EMPTY", number>;

beforeEach(async () => {
  ({ db, cleanup } = await createTestDb());
  const [p] = await db.insert(products).values({ name: "車門膠條" }).returning();
  const mk = async (code: string, bundle = false) =>
    (await db.insert(skus).values({ code, productId: p.id, isBundle: bundle, stock: bundle ? null : 0 }).returning())[0].id;
  ids = {
    FL: await mk("WS-FL"),
    FR: await mk("WS-FR"),
    RL: await mk("WS-RL"),
    RR: await mk("WS-RR"),
    SET: await mk("WS-SET", true),
    EMPTY: await mk("WS-EMPTY", true),
  };
  await db.insert(bundleComponents).values(
    (["FL", "FR", "RL", "RR"] as const).map((k) => ({ bundleSkuId: ids.SET, componentSkuId: ids[k], qty: 1 })),
  );
  for (const [k, n] of [["FL", 5], ["FR", 3], ["RL", 2], ["RR", 4]] as const) {
    await recordMovement(db, { skuId: ids[k], delta: n, reason: "initial", refType: "manual" });
  }
});
afterEach(() => cleanup());

const line = (over: Partial<ParsedOrderLine> = {}): ParsedOrderLine => ({
  orderNo: "A1",
  status: "待出貨",
  cancelled: false,
  orderedAt: Date.UTC(2026, 9, 23, 6),
  skuCode: "WS-FL",
  name: "膠條 前左",
  qty: 1,
  ...over,
});

const run = (lines: ParsedOrderLine[]) => importOrders(db, { platform: "shopee", filename: "orders.xlsx", lines });

async function stock() {
  const rows = await db.select({ id: skus.id, stock: skus.stock }).from(skus);
  const by = new Map(rows.map((r) => [r.id, r.stock]));
  return { FL: by.get(ids.FL), FR: by.get(ids.FR), RL: by.get(ids.RL), RR: by.get(ids.RR) };
}

async function cacheMatchesMovements() {
  const rows = await db
    .select({
      stock: skus.stock,
      sum: sql<number>`(select coalesce(sum(m.delta), 0) from stock_movements m where m.sku_id = "skus"."id")`,
    })
    .from(skus)
    .where(eq(skus.isBundle, false));
  return rows.every((r) => r.stock === Number(r.sum));
}

describe("importOrders", () => {
  const file = [
    line({ orderNo: "A1", skuCode: "WS-FL", qty: 1 }),
    line({ orderNo: "A2", skuCode: "WS-SET", name: "膠條 一車份", qty: 1 }),
    line({ orderNo: "A3", skuCode: "NOPE-1", name: "膠條 後左 2020款" }),
  ];

  it("creates orders, deducts matched items and bundle components, lists unmatched", async () => {
    const s = await run(file);
    expect(s).toMatchObject({ orders: 3, newOrders: 3, deducted: 2, cancelled: 0, unmatched: 1, emptyBundles: [] });
    expect(await stock()).toEqual({ FL: 3, FR: 2, RL: 1, RR: 3 });
    expect((await getAvailability(db)).get(ids.SET)).toBe(1);
    expect(await cacheMatchesMovements()).toBe(true);
  });

  it("deducts only once when the same file is imported twice", async () => {
    await run(file);
    const again = await run(file);
    expect(again).toMatchObject({ newOrders: 0, deducted: 0, cancelled: 0, unmatched: 1 });
    expect(await stock()).toEqual({ FL: 3, FR: 2, RL: 1, RR: 3 });
    expect(await db.select().from(orders)).toHaveLength(3);
    expect(await db.select().from(orderItems)).toHaveLength(3);
    expect(await cacheMatchesMovements()).toBe(true);
  });

  it("matches SKU codes regardless of case and full-width input", async () => {
    await run([line({ skuCode: "ｗｓ－ｆｌ" })]);
    expect((await stock()).FL).toBe(4);
  });

  it("merges repeated lines of the same SKU in one order", async () => {
    const s = await run([line({ qty: 1 }), line({ qty: 2 })]);
    expect(s.deducted).toBe(1);
    expect((await stock()).FL).toBe(2);
    expect((await db.select().from(orderItems))[0].qty).toBe(3);
  });

  it("puts stock back when an order turns cancelled, only once", async () => {
    await run(file);
    const cancelled = file.map((l) => ({ ...l, status: "已取消", cancelled: true }));
    const s = await run(cancelled);
    expect(s).toMatchObject({ cancelled: 2, deducted: 0 });
    expect(await stock()).toEqual({ FL: 5, FR: 3, RL: 2, RR: 4 });
    expect((await db.select().from(orders).where(eq(orders.platformOrderNo, "A1")))[0].status).toBe("已取消");

    expect((await run(cancelled)).cancelled).toBe(0);
    expect(await stock()).toEqual({ FL: 5, FR: 3, RL: 2, RR: 4 });
    expect(await cacheMatchesMovements()).toBe(true);
  });

  it("puts back what was actually deducted, even if the bundle changed since", async () => {
    await run([line({ orderNo: "B1", skuCode: "WS-SET" })]);
    await db.delete(bundleComponents).where(eq(bundleComponents.componentSkuId, ids.RR));
    await run([line({ orderNo: "B1", skuCode: "WS-SET", cancelled: true, status: "已取消" })]);
    expect(await stock()).toEqual({ FL: 5, FR: 3, RL: 2, RR: 4 });
  });

  it("does not touch stock for an order that is already cancelled on first import", async () => {
    const s = await run([line({ cancelled: true, status: "已取消" })]);
    expect(s).toMatchObject({ newOrders: 1, deducted: 0, cancelled: 0 });
    expect(await stock()).toEqual({ FL: 5, FR: 3, RL: 2, RR: 4 });
    expect(await db.select().from(stockMovements).where(eq(stockMovements.refType, "order_item"))).toHaveLength(0);
  });

  it("reports bundles without components instead of deducting nothing silently", async () => {
    const s = await run([line({ skuCode: "WS-EMPTY" })]);
    expect(s.emptyBundles).toEqual(["WS-EMPTY"]);
  });

  it("rejects payloads carrying PII and writes nothing", async () => {
    await expect(run([line({ name: "王小明 0912345678" })])).rejects.toThrow(PiiError);
    await expect(run([{ ...line(), buyer: "x" } as ParsedOrderLine])).rejects.toThrow(PiiError);
    expect(await db.select().from(orders)).toHaveLength(0);
  });
});

describe("mapOrderItem", () => {
  it("deducts on manual mapping, and a later re-import keeps the mapping without double deduction", async () => {
    await run([line({ orderNo: "C1", skuCode: "NOPE-1", qty: 2 })]);
    const [item] = await db.select().from(orderItems);
    expect(item.matched).toBe(false);

    expect(await mapOrderItem(db, item.id, ids.RL, ["已取消"])).toEqual({ deducted: true });
    expect((await stock()).RL).toBe(0);

    const again = await run([line({ orderNo: "C1", skuCode: "NOPE-1", qty: 2 })]);
    expect(again).toMatchObject({ unmatched: 0, deducted: 0 });
    expect((await stock()).RL).toBe(0);

    await run([line({ orderNo: "C1", skuCode: "NOPE-1", qty: 2, cancelled: true, status: "已取消" })]);
    expect((await stock()).RL).toBe(2);
    expect(await cacheMatchesMovements()).toBe(true);
  });

  it("does not deduct when the order is cancelled", async () => {
    await run([line({ orderNo: "C2", skuCode: "NOPE-2", cancelled: true, status: "已取消" })]);
    const [item] = await db.select().from(orderItems);
    expect(await mapOrderItem(db, item.id, ids.FL, ["已取消"])).toEqual({ deducted: false });
    expect((await stock()).FL).toBe(5);
  });

  it("refuses to map twice", async () => {
    await run([line({ orderNo: "C3", skuCode: "NOPE-3" })]);
    const [item] = await db.select().from(orderItems);
    await mapOrderItem(db, item.id, ids.FL, []);
    await expect(mapOrderItem(db, item.id, ids.FR, [])).rejects.toThrow("已經對應過");
  });
});
