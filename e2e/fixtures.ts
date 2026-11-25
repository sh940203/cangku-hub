import { read, utils, write } from "xlsx";

// A made-up Shopee 「價格及庫存」 template with the real layout (row 1 keys, row 2 hidden metadata,
// row 3 Chinese headers, rows 4-6 instructions). No real products.
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

export type Variation = { item: string; name: string; variant: string; variantName: string; stock: number };

export const WEATHERSTRIP: Variation[] = [
  { item: "9001", name: "測試膠條", variant: "90011", variantName: "前左", stock: 5 },
  { item: "9001", name: "測試膠條", variant: "90012", variantName: "前右", stock: 3 },
  { item: "9001", name: "測試膠條", variant: "90013", variantName: "後左", stock: 2 },
  { item: "9001", name: "測試膠條", variant: "90014", variantName: "後右", stock: 4 },
  { item: "9001", name: "測試膠條", variant: "90015", variantName: "一車份", stock: 2 },
  { item: "9002", name: "測試扳手", variant: "90021", variantName: "", stock: 7 },
];

export function salesInfoXlsx(rows: Variation[] = WEATHERSTRIP): Buffer {
  const aoa = [
    KEYS,
    ["sales_info", "e2e", "0", "1", '{"search_condition":{}}', "", "", "", "", "", ""],
    ["商品ID", "商品名稱", "商品選項ID", "商品規格名稱", "主商品貨號", "商品選項貨號", "價格", "國際條碼 (GTIN)", "庫存", "最低購買數量", "失敗原因"],
    ["", "", "", "", "", "", "必填", "", "必填", "", ""],
    Array(KEYS.length).fill(""),
    ["", "", "", "", "", "", "請輸入價格", "", "", "說明", ""],
    ...rows.map((r) => [r.item, r.name, r.variant, r.variantName, "", "", "150", "", String(r.stock), "1", ""]),
  ];
  const wb = utils.book_new();
  utils.book_append_sheet(wb, utils.aoa_to_sheet(aoa), "Sheet1");
  return write(wb, { type: "buffer", bookType: "xlsx" });
}

/** Reads a downloaded template back: variation ID → {parentSku, sku, price, stock}. */
export function readSalesInfo(buf: Buffer) {
  const wb = read(buf);
  const rows = utils.sheet_to_json<string[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "", raw: false });
  const out = new Map<string, { parentSku: string; sku: string; price: string; stock: string }>();
  for (const r of rows.slice(6)) out.set(String(r[2]), { parentSku: r[4], sku: r[5], price: r[6], stock: String(r[8]) });
  return { rows, byVariant: out };
}
