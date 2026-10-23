import type { Platform } from "@/db/schema";

/** One order line after parsing and PII removal: the only shape that is sent to the server. */
export type ParsedOrderLine = {
  orderNo: string;
  /** Platform's own status text, e.g. as shown in the seller center. */
  status: string;
  /** Whether that status means the order was cancelled (stock goes back). */
  cancelled: boolean;
  orderedAt: number | null; // unix ms
  /** Variant SKU code as typed in the platform; matched against skus.code. May be empty. */
  skuCode: string;
  name: string;
  qty: number;
};

export type SkippedRow = { row: number; reason: string };

export type ParseResult =
  | { ok: true; lines: ParsedOrderLine[]; skipped: SkippedRow[] }
  | { ok: false; error: string };

export interface PlatformAdapter {
  id: Platform;
  label: string;
  /** False until the platform's real export columns have been confirmed (see columns.ts). */
  ready: boolean;
  /** Status texts that mean cancelled; used when an item is mapped by hand after import. */
  cancelledStatuses: readonly string[];
  /** Rows are sheet rows keyed by header, already stripped of PII columns. */
  parseOrders(rows: Record<string, unknown>[]): ParseResult;
}
