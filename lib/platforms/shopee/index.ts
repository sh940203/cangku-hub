import { parseOrderRows } from "../shared/parse-orders";
import type { PlatformAdapter } from "../types";
import { shopeeColumnsReady, shopeeOrderColumns } from "./columns";
import { parseSalesInfo, salesInfoEdits } from "./sales-info";

export const shopee: PlatformAdapter = {
  id: "shopee",
  label: "蝦皮",
  ready: shopeeColumnsReady,
  cancelledStatuses: shopeeOrderColumns.cancelledStatuses,
  parseOrders(rows) {
    if (!shopeeColumnsReady) return { ok: false, error: "蝦皮訂單的欄位還沒設定，請先提供一份蝦皮訂單匯出檔。" };
    return parseOrderRows(rows, shopeeOrderColumns);
  },
  listings: {
    howToGet: "賣家中心 → 我的商品 → 更新商品資料，模板選「價格及庫存」，按下載。",
    parse: parseSalesInfo,
    edits: salesInfoEdits,
  },
};
