import { describe, expect, it } from "vitest";
import { parseSalesInfo, salesInfoEdits } from "./sales-info";

// Same layout as the real template, with made-up products.
const KEYS = [
  "et_title_product_id",
  "et_title_product_name",
  "et_title_variation_id",
  "et_title_variation_name",
  "et_title_parent_sku",
  "et_title_variation_sku",
  "et_title_variation_price",
  "ps_gtin_code",
  "et_title_variation_stock",
  "ps_minimum_purchase_quantity",
  "et_title_reason",
];
const template = (...data: string[][]) => [
  KEYS,
  ["sales_info", "hash", "0", "1", "{}", "", "", "", "", "", ""],
  ["商品ID", "商品名稱", "商品選項ID", "商品規格名稱", "主商品貨號", "商品選項貨號", "價格", "國際條碼 (GTIN)", "庫存", "最低購買數量", "失敗原因"],
  ["", "", "", "", "", "", "必填", "", "必填", "", ""],
  Array(11).fill(""),
  ["", "", "", "", "", "", "請輸入價格", "", "", "說明", ""],
  ...data,
];
const row = (item: string, name: string, variant: string, vName: string, stock: string, sku = "") => [
  item, name, variant, vName, "", sku, "100", "", stock, "1", "",
];

describe("parseSalesInfo", () => {
  it("reads variation rows and skips header/instruction rows", () => {
    const res = parseSalesInfo(
      template(row("11", "膠條", "101", "前左", "5", "0"), row("11", "膠條", "102", "前右", "0"), row("12", "扳手", "201", "", "3")),
    );
    expect(res.ok && res.lines).toEqual([
      { itemId: "11", itemName: "膠條", variantId: "101", variantName: "前左", skuCode: "", stock: 5 },
      { itemId: "11", itemName: "膠條", variantId: "102", variantName: "前右", skuCode: "", stock: 0 },
      { itemId: "12", itemName: "扳手", variantId: "201", variantName: "", skuCode: "", stock: 3 },
    ]);
  });

  it("rejects a file that is not the sales-info template", () => {
    expect(parseSalesInfo([["商品ID", "商品名稱"]]).ok).toBe(false);
    expect(parseSalesInfo([]).ok).toBe(false);
  });

  it("skips bad stock and duplicate variation IDs with the row number", () => {
    const res = parseSalesInfo(template(row("11", "A", "101", "", "-1"), row("12", "B", "201", "", "2"), row("12", "B", "201", "", "2")));
    expect(res.ok && res.lines.map((l) => l.variantId)).toEqual(["201"]);
    expect(res.ok && res.skipped).toEqual([
      { row: 7, reason: "庫存不是 0 以上的整數" },
      { row: 9, reason: "商品選項ID重複" },
    ]);
  });
});

describe("salesInfoEdits", () => {
  it("writes codes into the SKU columns of matching rows only", () => {
    const rows = template(row("11", "A", "101", "x", "5"), row("12", "B", "201", "", "3"));
    const edits = salesInfoEdits(rows, new Map([["101", { skuCode: "P0001-01", productCode: "P0001" }]]));
    expect(edits).toEqual([
      { row: 6, col: 4, value: "P0001" },
      { row: 6, col: 5, value: "P0001-01" },
    ]);
  });

  it("also writes stock when given", () => {
    const rows = template(row("12", "B", "201", "", "3"));
    expect(salesInfoEdits(rows, new Map([["201", { skuCode: "P0002", productCode: "P0002", stock: 7 }]]))).toContainEqual({
      row: 6,
      col: 8,
      value: 7,
    });
  });
});
