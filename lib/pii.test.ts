import { describe, expect, it } from "vitest";
import { assertNoPii, isPiiHeader, PiiError, stripPiiColumns } from "./pii";

const line = {
  orderNo: "2510230001",
  status: "待出貨",
  cancelled: false,
  orderedAt: 1792700000000,
  skuCode: "WS-FL",
  name: "車門膠條 前左",
  qty: 1,
};

describe("isPiiHeader", () => {
  it.each(["收件者姓名", "收件人電話", "收件地址", "買家帳號", "Email", "買家備註", "郵遞區號", "Recipient Name", "Ｅｍａｉｌ"])(
    "drops %s",
    (h) => expect(isPiiHeader(h)).toBe(true),
  );
  it.each(["訂單編號", "訂單狀態", "商品名稱", "商品選項貨號", "數量", "訂單成立日期"])("keeps %s", (h) =>
    expect(isPiiHeader(h)).toBe(false),
  );
});

describe("stripPiiColumns", () => {
  it("removes PII columns and reports them", () => {
    const { rows, dropped } = stripPiiColumns([
      { 訂單編號: "A1", 收件者姓名: "王小明", 收件地址: "台北市信義區信義路五段7號", 數量: 1 },
      { 訂單編號: "A2", 收件者姓名: "陳大華", 收件地址: "新北市板橋區", 數量: 2 },
    ]);
    expect(rows).toEqual([
      { 訂單編號: "A1", 數量: 1 },
      { 訂單編號: "A2", 數量: 2 },
    ]);
    expect(dropped.sort()).toEqual(["收件地址", "收件者姓名"]);
    expect(JSON.stringify(rows)).not.toMatch(/王小明|陳大華|信義路/);
  });
});

describe("assertNoPii", () => {
  it("accepts a clean order line", () => {
    expect(() => assertNoPii([line])).not.toThrow();
  });

  it("rejects fields outside the whitelist", () => {
    expect(() => assertNoPii([{ ...line, buyer: "someone" }])).toThrow(PiiError);
  });

  it.each([
    ["email", "聯絡 test@example.com"],
    ["mobile", "0912-345-678"],
    ["mobile without dashes", "0912345678"],
    ["landline", "(02)2345-6789"],
    ["address", "台北市信義區信義路五段7號"],
  ])("rejects a value that looks like %s", (_, value) => {
    expect(() => assertNoPii([{ ...line, name: value }])).toThrow(PiiError);
  });

  it("does not flag ordinary product names or order numbers", () => {
    for (const name of ["棘輪扳手 72 齒", "膠條 2020-2023 款", "M8 螺絲 100 入", "LED 燈條 12V 5M"]) {
      expect(() => assertNoPii([{ ...line, name }])).not.toThrow();
    }
    expect(() => assertNoPii([{ ...line, orderNo: "251023ABCD0912" }])).not.toThrow();
  });
});
