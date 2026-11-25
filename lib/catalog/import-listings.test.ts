import { asc, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/db";
import { platformListings, products, skus, stockMovements } from "@/db/schema";
import type { ListingLine } from "@/lib/platforms/types";
import { createTestDb } from "@/lib/test/db";
import { importListings, listingCodes, productCodeOf } from "./import-listings";

let db: Db;
let cleanup: () => void;
beforeEach(async () => ({ db, cleanup } = await createTestDb()));
afterEach(() => cleanup());

const l = (itemId: string, variantId: string, variantName = "", stock = 0, over: Partial<ListingLine> = {}): ListingLine => ({
  itemId,
  itemName: `商品${itemId}`,
  variantId,
  variantName,
  skuCode: "",
  stock,
  ...over,
});
const run = (lines: ListingLine[]) => importListings(db, { platform: "shopee", lines });
const codes = async () =>
  (await db.select({ code: skus.code, name: skus.variantName, stock: skus.stock }).from(skus).orderBy(asc(skus.code)));

describe("importListings", () => {
  it("creates products, numbered codes, listings and initial stock", async () => {
    const s = await run([l("11", "101", "前左", 5), l("11", "102", "前右", 0), l("12", "201", "", 3)]);
    expect(s).toEqual({ newProducts: 2, newSkus: 3, linked: 0, existing: 0, stockAdded: 8 });
    expect(await codes()).toEqual([
      { code: "P0001-01", name: "前左", stock: 5 },
      { code: "P0001-02", name: "前右", stock: 0 },
      { code: "P0002", name: null, stock: 3 },
    ]);
    expect((await db.select().from(products)).map((p) => p.name)).toEqual(["商品11", "商品12"]);
    const links = await db.select().from(platformListings);
    expect(links.map((x) => x.lastPushedStock)).toEqual([5, 0, 3]);
  });

  it("stock cache equals the sum of movements", async () => {
    await run([l("11", "101", "a", 5), l("12", "201", "", 3)]);
    const moves = await db.select().from(stockMovements);
    expect(moves.map((m) => [m.reason, m.refType, m.delta])).toEqual([
      ["initial", "import_batch", 5],
      ["initial", "import_batch", 3],
    ]);
  });

  it("importing the same file twice adds nothing", async () => {
    const lines = [l("11", "101", "a", 5), l("12", "201", "", 3)];
    await run(lines);
    expect(await run(lines)).toEqual({ newProducts: 0, newSkus: 0, linked: 0, existing: 2, stockAdded: 0 });
    expect(await codes()).toHaveLength(2);
    expect(await db.select().from(stockMovements)).toHaveLength(2);
  });

  it("a new variation of a known product gets the next suffix, and known stock is not overwritten", async () => {
    await run([l("11", "101", "", 5)]);
    const s = await run([l("11", "101", "", 99), l("11", "102", "新", 2)]);
    expect(s).toMatchObject({ newProducts: 0, newSkus: 1, existing: 1, stockAdded: 2 });
    expect(await codes()).toEqual([
      { code: "P0001", name: null, stock: 5 },
      { code: "P0001-02", name: "新", stock: 2 },
    ]);
    expect(await db.select().from(products)).toHaveLength(1);
  });

  it("continues numbering after existing P codes", async () => {
    const [p] = await db.insert(products).values({ name: "舊" }).returning();
    await db.insert(skus).values({ code: "P0041", productId: p.id, stock: 0 });
    await run([l("11", "101")]);
    expect((await codes()).map((c) => c.code)).toEqual(["P0041", "P0042"]);
  });

  it("links to an unlinked SKU with the same code instead of creating one", async () => {
    const [p] = await db.insert(products).values({ name: "手建" }).returning();
    const [sku] = await db.insert(skus).values({ code: "WS-FL", productId: p.id, stock: 4 }).returning();
    const s = await run([l("11", "101", "", 9, { skuCode: "ws-fl" })]);
    expect(s).toEqual({ newProducts: 0, newSkus: 0, linked: 1, existing: 0, stockAdded: 0 });
    const [link] = await db.select().from(platformListings);
    expect(link.skuId).toBe(sku.id);
    expect(link.lastPushedStock).toBeNull();
    expect((await db.select().from(skus).where(eq(skus.id, sku.id)))[0].stock).toBe(4);
  });

  it("handles more products than one batch", async () => {
    const lines = Array.from({ length: 230 }, (_, i) => l(String(1000 + i), String(5000 + i), "", 1));
    const s = await run(lines);
    expect(s).toMatchObject({ newProducts: 230, newSkus: 230, stockAdded: 230 });
    const all = await codes();
    expect(all.at(-1)?.code).toBe("P0230");
    expect(all.every((c) => c.stock === 1)).toBe(true);
  });
});

describe("listingCodes", () => {
  it("returns our code and product code per variation", async () => {
    await run([l("11", "101", "a"), l("11", "102", "b"), l("12", "201")]);
    const map = await listingCodes(db, "shopee", ["101", "201", "999"]);
    expect(map.get("101")).toMatchObject({ skuCode: "P0001-01", productCode: "P0001" });
    expect(map.get("201")).toMatchObject({ skuCode: "P0002", productCode: "P0002" });
    expect(map.has("999")).toBe(false);
  });

  it("productCodeOf ignores non-P codes", () => {
    expect(productCodeOf("P0012-03")).toBe("P0012");
    expect(productCodeOf("WS-FL")).toBe("");
  });
});
