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
  /** Product/stock template, when the platform's has been confirmed. */
  listings?: ListingTemplate;
}

/** One platform variation from a product/stock export. Product data only, no customer data. */
export type ListingLine = {
  /** Platform product ID. */
  itemId: string;
  itemName: string;
  /** Platform variation ID; unique per row. */
  variantId: string;
  /** Empty for single-variation products. */
  variantName: string;
  /** Variation SKU code already typed on the platform; may be empty. */
  skuCode: string;
  stock: number;
};

export type ListingParseResult =
  | { ok: true; lines: ListingLine[]; skipped: SkippedRow[] }
  | { ok: false; error: string };

/** A change to one cell (0-based row/col) of a platform template that is written back as-is. */
export type CellEdit = { row: number; col: number; value: string | number };

/** Platform product template: read listings, and write our codes/stock back into the same file. */
export interface ListingTemplate {
  /** What the user downloads, in the seller center's own words. */
  howToGet: string;
  parse(rows: readonly (readonly unknown[])[]): ListingParseResult;
  edits(
    rows: readonly (readonly unknown[])[],
    codes: ReadonlyMap<string, { skuCode: string; productCode: string; stock?: number }>,
  ): CellEdit[];
}
