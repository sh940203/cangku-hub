import { expect, test } from "@playwright/test";

// Every page renders a heading without a server error or an uncaught browser error.
const PAGES: [string, string][] = [
  ["/", "今日"],
  ["/find", "找貨"],
  ["/stocktake", "盤點"],
  ["/restock", "叫貨"],
  ["/products", "商品"],
  ["/products/import", "從平台匯入商品"],
  ["/locations", "儲位"],
  ["/import", "訂單匯入"],
  ["/export", "更新蝦皮庫存"],
];

for (const [path, heading] of PAGES) {
  test(`${path} renders`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 }).first()).toContainText(heading);
    expect(errors).toEqual([]);
  });
}
