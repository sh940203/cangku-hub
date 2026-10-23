import { describe, expect, it } from "vitest";
import { restockText } from "./low-stock";

describe("restockText", () => {
  it("formats one line per SKU for LINE", () => {
    const text = restockText(
      [
        { id: 1, code: "WS-RL", variantName: "後左", productName: "車門膠條", stock: 1, safetyStock: 2, locationCode: "4F-T-03" },
        { id: 2, code: "TL-1", variantName: null, productName: "棘輪扳手", stock: 0, safetyStock: 1, locationCode: null },
      ],
      new Date(Date.UTC(2026, 9, 23, 2)),
    );
    expect(text).toBe("叫貨清單 10/23\n・車門膠條 後左（WS-RL）現有 1，安全 2\n・棘輪扳手（TL-1）現有 0，安全 1");
  });
});
