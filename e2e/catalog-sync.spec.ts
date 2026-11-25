import { expect, type Page, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { readSalesInfo, salesInfoXlsx, WEATHERSTRIP } from "./fixtures";

// The MVP loop with a made-up catalog: import Shopee listings → write codes back → turn 一車份 into a bundle
// → a part's stock drops → the stock file carries the new numbers → 已上傳 clears the pending list.
test.describe.configure({ mode: "serial" });

const template = () => ({
  name: "mass_update_sales_info_e2e.xlsx",
  mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  buffer: salesInfoXlsx(),
});

async function download(page: Page, click: () => Promise<void>) {
  const [dl] = await Promise.all([page.waitForEvent("download"), click()]);
  return readSalesInfo(readFileSync(await dl.path()));
}

/** SKU page URL for a code, found through the products search. */
async function skuUrl(page: Page, code: string) {
  await page.goto(`/products?q=${encodeURIComponent(code)}`);
  const row = page.locator("tr", { hasText: code });
  return (await row.getByRole("link").first().getAttribute("href"))!;
}

test("import listings and download the template with codes filled in", async ({ page }) => {
  await page.goto("/products/import");
  await page.locator('input[type="file"]').setInputFiles(template());
  await expect(page.locator("dl")).toHaveText(/商品\s*2\s*規格\s*6\s*有庫存\s*6/);
  await page.getByRole("button", { name: "匯入商品" }).click();
  await expect(page.getByRole("status")).toContainText("新商品 2、新貨號 6");
  await expect(page.getByRole("status")).toContainText("初始庫存共 23 件");

  const back = await download(page, () => page.getByRole("button", { name: "下載填好貨號的檔案" }).click());
  expect(back.byVariant.get("90011")).toEqual({ parentSku: "P0001", sku: "P0001-01", price: "150", stock: "5" });
  expect(back.byVariant.get("90015")?.sku).toBe("P0001-05");
  expect(back.byVariant.get("90021")).toMatchObject({ parentSku: "P0002", sku: "P0002" });
  expect(back.rows[1][1]).toBe("e2e"); // hidden metadata row kept
});

test("importing the same file again creates nothing", async ({ page }) => {
  await page.goto("/products/import");
  await page.locator('input[type="file"]').setInputFiles(template());
  await page.getByRole("button", { name: "匯入商品" }).click();
  await expect(page.getByRole("status")).toContainText("新商品 0、新貨號 0");
  await expect(page.getByRole("status")).toContainText("6 個規格之前已匯入");
});

test("nothing to push right after import", async ({ page }) => {
  await page.goto("/export");
  await expect(page.getByRole("heading", { name: "待更新 0 個規格" })).toBeVisible();
});

test("turn 一車份 into a bundle of the four parts", async ({ page }) => {
  await page.goto(await skuUrl(page, "P0001-05"));
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "改成組合" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("一車份（組合）");

  for (const code of ["P0001-01", "P0001-02", "P0001-03", "P0001-04"]) {
    const select = page.locator('select[name="componentSkuId"]');
    const value = await select.locator("option", { hasText: code }).getAttribute("value");
    await select.selectOption(value!);
    await page.getByRole("button", { name: "加入部件" }).click();
    await expect(page.locator("li", { hasText: code })).toBeVisible();
  }
  // min(5, 3, 2, 4) = 2, same as Shopee had
  const sellable = () => page.getByText("可售", { exact: true }).locator("xpath=following-sibling::*[1]");
  await expect(sellable()).toHaveText(/^2/);
});

test("selling a part shows the part and the bundle as pending", async ({ page }) => {
  const url = await skuUrl(page, "P0001-03");
  const skuId = url.split("/").pop();
  await page.goto(`/stocktake/${skuId}`);
  await page.locator('input[name="counted"]').fill("1");
  await page.getByRole("button", { name: "寫入盤點數量" }).click();
  await expect(page.locator("body")).toContainText("1");

  await page.goto("/export");
  await expect(page.getByRole("heading", { name: "待更新 2 個規格" })).toBeVisible();
  const rows = page.locator("tbody tr");
  await expect(rows.filter({ hasText: "P0001-03" })).toContainText(/2\s*1/);
  await expect(rows.filter({ hasText: "P0001-05" })).toContainText("組合");
});

test("the stock file carries the new numbers and 已上傳 clears the list", async ({ page }) => {
  await page.goto("/export");
  // Meanwhile one 前左 sold on Shopee (orders are not imported): Shopee now says 4, we still say 5.
  const latest = {
    ...template(),
    buffer: salesInfoXlsx(WEATHERSTRIP.map((v) => (v.variant === "90011" ? { ...v, stock: 4 } : v))),
  };
  const back = await download(page, () => page.locator('input[type="file"]').setInputFiles(latest));
  expect(back.byVariant.get("90013")).toMatchObject({ sku: "P0001-03", stock: "1", price: "150" });
  expect(back.byVariant.get("90015")).toMatchObject({ sku: "P0001-05", stock: "1" });
  // not pending on our side, so Shopee's own number stays and the sale is not undone
  expect(back.byVariant.get("90011")).toMatchObject({ sku: "P0001-01", stock: "4" });
  await expect(page.getByRole("status")).toContainText("2 個待更新規格填入系統可售量，其中 2 個和蝦皮現在不同");

  await page.getByRole("button", { name: "已上傳到蝦皮" }).click();
  await expect(page.getByRole("status").last()).toContainText("已記錄");
  await page.reload();
  await expect(page.getByRole("heading", { name: "待更新 0 個規格" })).toBeVisible();
});

test("find shows the bundle and its sellable quantity", async ({ page }) => {
  await page.goto("/find");
  await page.getByRole("searchbox", { name: "搜尋商品名、貨號" }).fill("P0001-05");
  const hit = page.getByRole("button", { name: /一車份/ });
  await expect(hit).toContainText("組合");
  await expect(hit).toContainText("1");
});
