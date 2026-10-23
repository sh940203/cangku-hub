// Header-driven order sheet parser shared by platform adapters. Each platform only supplies column names.
import type { ParsedOrderLine, ParseResult, SkippedRow } from "../types";

export type OrderColumns = {
  orderNo: string;
  status: string;
  orderedAt: string;
  /** Variant-level SKU code column; falls back to `skuCodeFallback` when empty. */
  skuCode: string;
  skuCodeFallback?: string;
  name: string;
  qty: string;
  /** Status texts that mean the order was cancelled. */
  cancelledStatuses: readonly string[];
};

const text = (v: unknown) => (v == null ? "" : String(v).normalize("NFKC").trim());

/** Excel serial date (days since 1899-12-30, local time) */
const fromSerial = (n: number) => Math.round((n - 25569) * 86400000) - 8 * 3600000;

/** Dates without a timezone are taken as Taiwan time. */
export function parseTaipeiDate(v: unknown): number | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.getTime();
  if (typeof v === "number" && Number.isFinite(v)) return fromSerial(v);
  const s = text(v);
  const m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(s);
  if (!m) return null;
  const [, y, mo, d, h = "0", mi = "0", se = "0"] = m;
  return Date.UTC(+y, +mo - 1, +d, +h - 8, +mi, +se);
}

export function parseOrderRows(rows: readonly Record<string, unknown>[], cols: OrderColumns): ParseResult {
  if (rows.length === 0) return { ok: false, error: "檔案裡沒有任何資料列。" };
  const headers = new Set(rows.flatMap((r) => Object.keys(r)));
  const required = [cols.orderNo, cols.status, cols.orderedAt, cols.skuCode, cols.name, cols.qty];
  const missing = required.filter((h) => !headers.has(h));
  if (missing.length) {
    return { ok: false, error: `找不到欄位：${missing.join("、")}。請確認選對平台，且檔案是訂單匯出原檔。` };
  }
  const cancelled = new Set(cols.cancelledStatuses.map(text));

  const lines: ParsedOrderLine[] = [];
  const skipped: SkippedRow[] = [];
  rows.forEach((r, i) => {
    const row = i + 2; // header is row 1
    const orderNo = text(r[cols.orderNo]);
    if (!orderNo) return skipped.push({ row, reason: "沒有訂單編號" });
    const qtyText = text(r[cols.qty]);
    const qty = Number(qtyText);
    if (!Number.isInteger(qty) || qty <= 0) return skipped.push({ row, reason: `數量「${qtyText}」不是正整數` });
    const status = text(r[cols.status]);
    lines.push({
      orderNo,
      status,
      cancelled: cancelled.has(status),
      orderedAt: parseTaipeiDate(r[cols.orderedAt]),
      skuCode: text(r[cols.skuCode]) || (cols.skuCodeFallback ? text(r[cols.skuCodeFallback]) : ""),
      name: text(r[cols.name]),
      qty,
    });
  });
  return { ok: true, lines, skipped };
}
