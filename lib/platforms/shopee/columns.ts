// Shopee order export column names.
// TODO: not confirmed yet. Fill these in from a real export placed in samples/ (gitignored); do not guess.
import type { OrderColumns } from "../shared/parse-orders";

const TODO = "TODO";

export const shopeeOrderColumns: OrderColumns = {
  orderNo: TODO, // 訂單編號?
  status: TODO, // 訂單狀態?
  orderedAt: TODO, // 訂單成立日期?
  skuCode: TODO, // 規格貨號 (variant SKU) — matched against skus.code
  skuCodeFallback: undefined, // 主商品貨號? used when the variant SKU is empty
  name: TODO, // 商品名稱 / 商品選項名稱?
  qty: TODO, // 數量?
  cancelledStatuses: [], // TODO: which status texts mean cancelled (不成立? 已取消?)
};

export const shopeeColumnsReady = !Object.values(shopeeOrderColumns).includes(TODO);
