import { describe, expect, it } from "vitest";
import { type OrderColumns, parseOrderRows, parseTaipeiDate } from "./parse-orders";

// Made-up column names for testing the parser only; real platform names live in each columns.ts.
const cols: OrderColumns = {
  orderNo: "OrderNo",
  status: "Status",
  orderedAt: "Created",
  skuCode: "VariantSku",
  skuCodeFallback: "ParentSku",
  name: "Item",
  qty: "Qty",
  cancelledStatuses: ["Cancelled"],
};

const row = (over: Record<string, unknown> = {}) => ({
  OrderNo: "A1",
  Status: "ToShip",
  Created: "2026-10-23 14:05",
  VariantSku: "WS-FL",
  ParentSku: "WS",
  Item: "膠條 前左",
  Qty: 1,
  ...over,
});

describe("parseOrderRows", () => {
  it("maps columns into order lines", () => {
    const res = parseOrderRows([row()], cols);
    expect(res).toEqual({
      ok: true,
      skipped: [],
      lines: [
        {
          orderNo: "A1",
          status: "ToShip",
          cancelled: false,
          orderedAt: Date.UTC(2026, 9, 23, 6, 5),
          skuCode: "WS-FL",
          name: "膠條 前左",
          qty: 1,
        },
      ],
    });
  });

  it("flags cancelled statuses and falls back to the parent SKU", () => {
    const res = parseOrderRows([row({ Status: "Cancelled", VariantSku: "" })], cols);
    expect(res.ok && res.lines[0]).toMatchObject({ cancelled: true, skuCode: "WS" });
  });

  it("reports missing columns", () => {
    const { Qty: _qty, ...noQty } = row();
    const res = parseOrderRows([noQty], cols);
    expect(res).toEqual({ ok: false, error: expect.stringContaining("Qty") });
  });

  it("skips rows without an order number or with a bad qty", () => {
    const res = parseOrderRows([row(), row({ OrderNo: "" }), row({ Qty: "0" }), row({ Qty: "1.5" })], cols);
    expect(res.ok && res.lines).toHaveLength(1);
    expect(res.ok && res.skipped.map((s) => s.row)).toEqual([3, 4, 5]);
  });

  it("rejects an empty sheet", () => {
    expect(parseOrderRows([], cols).ok).toBe(false);
  });
});

describe("parseTaipeiDate", () => {
  it("reads strings as Taiwan time", () => {
    expect(parseTaipeiDate("2026/10/23 00:30")).toBe(Date.UTC(2026, 9, 22, 16, 30));
    expect(parseTaipeiDate("2026-10-23")).toBe(Date.UTC(2026, 9, 22, 16));
  });
  it("reads Excel serial dates as Taiwan time", () => {
    // 46318 = 2026-10-23 (Excel serial), 0.5 = noon
    expect(parseTaipeiDate(46318.5)).toBe(Date.UTC(2026, 9, 23, 4));
  });
  it("returns null for junk", () => expect(parseTaipeiDate("下午")).toBeNull());
});
