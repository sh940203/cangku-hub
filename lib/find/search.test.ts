import { describe, expect, it } from "vitest";
import { searchSkus, snapshotAvailability } from "./search";
import type { SnapshotSku } from "./types";

const sku = (over: Partial<SnapshotSku> & Pick<SnapshotSku, "id" | "code">): SnapshotSku => ({
  barcode: null,
  productName: "車門膠條 示意車型",
  variantName: null,
  isBundle: false,
  active: true,
  stock: 0,
  safetyStock: null,
  locationCode: "4F-T-03",
  components: [],
  ...over,
});

const skus = [
  sku({ id: 1, code: "WS-FL", variantName: "前左", stock: 5 }),
  sku({ id: 2, code: "WS-FR", variantName: "前右", stock: 3 }),
  sku({ id: 3, code: "WS-RL", variantName: "後左", stock: 2, barcode: "4710000000017" }),
  sku({ id: 4, code: "WS-RR", variantName: "後右", stock: 4 }),
  sku({
    id: 5,
    code: "WS-SET",
    variantName: "一車份",
    isBundle: true,
    stock: null,
    locationCode: null,
    components: [1, 2, 3, 4].map((skuId) => ({ skuId, qty: 1 })),
  }),
  sku({ id: 6, code: "TL-01", productName: "棘輪扳手", variantName: null, stock: 7 }),
  sku({ id: 7, code: "WS-OLD", variantName: "舊款", active: false }),
];

const ids = (q: string) => searchSkus(skus, q).map((s) => s.id);

describe("searchSkus", () => {
  it("matches product name, variant, code and barcode", () => {
    expect(ids("膠條")).toEqual([1, 2, 3, 4, 5]);
    expect(ids("前左")).toEqual([1]);
    expect(ids("tl-01")).toEqual([6]);
    expect(ids("4710000000017")).toEqual([3]);
  });

  it("requires every term", () => {
    expect(ids("膠條 後")).toEqual([3, 4]);
    expect(ids("膠條 扳手")).toEqual([]);
  });

  it("folds full-width input", () => {
    expect(ids("ＷＳ－ＦＬ")).toEqual([1]);
  });

  it("puts an exact code first, then code prefixes", () => {
    const list = [sku({ id: 10, code: "AB-1", productName: "XAB-12 支架" }), sku({ id: 11, code: "AB-12" })];
    expect(searchSkus(list, "ab-12").map((s) => s.id)).toEqual([11, 10]);
    expect(searchSkus(skus, "ws").map((s) => s.id)).toEqual([1, 2, 3, 4, 5]);
  });

  it("skips archived SKUs and empty queries", () => {
    expect(ids("舊款")).toEqual([]);
    expect(ids("   ")).toEqual([]);
  });
});

describe("snapshotAvailability", () => {
  it("computes bundles from component stock, including archived components", () => {
    const withArchivedPart = [...skus, sku({ id: 8, code: "B", isBundle: true, stock: null, components: [{ skuId: 7, qty: 1 }] })];
    withArchivedPart[6] = { ...withArchivedPart[6], stock: 3 };
    const avail = snapshotAvailability({ generatedAt: 0, skus: withArchivedPart });
    expect(avail.get(5)).toBe(2);
    expect(avail.get(1)).toBe(5);
    expect(avail.get(8)).toBe(3);
  });
});
