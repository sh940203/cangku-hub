// Shopee 「更新商品資料 → 價格及庫存」 template (mass_update_sales_info_*.xlsx).
// Confirmed from a real download (2026-11-26):
//   row 1: machine keys (et_title_product_id, ...)  row 2: hidden metadata, must be kept as is
//   row 3: Chinese headers                         rows 4-6: required marks / instructions
//   then one row per variation. Single-variation products still have a variation ID and an empty name.
// Columns are located by the machine keys in row 1, not by position.
import type { CellEdit, ListingLine, ListingParseResult } from "../types";

export const SALES_INFO_KEYS = {
  itemId: "et_title_product_id",
  itemName: "et_title_product_name",
  variantId: "et_title_variation_id",
  variantName: "et_title_variation_name",
  parentSku: "et_title_parent_sku",
  variantSku: "et_title_variation_sku",
  stock: "et_title_variation_stock",
} as const;

const ID = /^\d+$/;
const text = (v: unknown) => String(v ?? "").trim();

function columnIndex(header: readonly unknown[]) {
  const idx = {} as Record<keyof typeof SALES_INFO_KEYS, number>;
  for (const [k, key] of Object.entries(SALES_INFO_KEYS) as [keyof typeof SALES_INFO_KEYS, string][]) {
    const i = header.findIndex((h) => text(h) === key);
    if (i < 0) return null;
    idx[k] = i;
  }
  return idx;
}

/** `rows` is the first sheet as an array of rows (SheetJS `header: 1`). */
export function parseSalesInfo(rows: readonly (readonly unknown[])[]): ListingParseResult {
  const idx = rows.length ? columnIndex(rows[0]) : null;
  if (!idx) {
    return { ok: false, error: "這不是蝦皮「價格及庫存」範本。請到賣家中心 → 我的商品 → 更新商品資料，模板選「價格及庫存」下載。" };
  }
  const lines: ListingLine[] = [];
  const skipped: { row: number; reason: string }[] = [];
  const seen = new Set<string>();
  rows.forEach((r, i) => {
    const itemId = text(r[idx.itemId]);
    if (!ID.test(itemId)) return; // header, instruction and blank rows
    const row = i + 1;
    const variantId = text(r[idx.variantId]);
    if (!ID.test(variantId)) return skipped.push({ row, reason: "沒有商品選項ID" });
    if (seen.has(variantId)) return skipped.push({ row, reason: "商品選項ID重複" });
    const stock = Number(text(r[idx.stock]) || "0");
    if (!Number.isInteger(stock) || stock < 0) return skipped.push({ row, reason: "庫存不是 0 以上的整數" });
    const sku = text(r[idx.variantSku]);
    seen.add(variantId);
    lines.push({
      itemId,
      itemName: text(r[idx.itemName]),
      variantId,
      variantName: text(r[idx.variantName]),
      // Shopee fills "0" when there is no code.
      skuCode: sku === "0" ? "" : sku,
      stock,
    });
  });
  if (lines.length === 0) return { ok: false, error: "檔案裡沒有任何商品規格。" };
  return { ok: true, lines, skipped };
}

/**
 * Cell edits that write our codes (and optionally stock) back into the same template, keyed by variation ID.
 * Rows whose variation is not in `codes` are left untouched.
 */
export function salesInfoEdits(
  rows: readonly (readonly unknown[])[],
  codes: ReadonlyMap<string, { skuCode: string; productCode: string; stock?: number }>,
): CellEdit[] {
  const idx = rows.length ? columnIndex(rows[0]) : null;
  if (!idx) return [];
  const edits: CellEdit[] = [];
  rows.forEach((r, i) => {
    if (!ID.test(text(r[idx.itemId]))) return;
    const c = codes.get(text(r[idx.variantId]));
    if (!c) return;
    if (c.productCode) edits.push({ row: i, col: idx.parentSku, value: c.productCode });
    edits.push({ row: i, col: idx.variantSku, value: c.skuCode });
    if (c.stock !== undefined) edits.push({ row: i, col: idx.stock, value: c.stock });
  });
  return edits;
}
