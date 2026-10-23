// Order import: upsert orders, match SKUs, deduct stock; cancellations put stock back.
// Platform-agnostic: input lines are already parsed and stripped of PII in the browser.
//
// Idempotency: every sale movement uses ref (order_item, "<platform>:<orderNo>:<item key>") and the
// unique (ref_type, ref_id, sku_id, reason) index, so importing the same file twice deducts once.
// Reads happen up front in a few queries; all writes go in one batch (Turso is a network hop away).
import { and, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { type Platform, bundleComponents, importBatches, orderItems, orders, skus, stockMovements } from "@/db/schema";
import { assertNoPii } from "@/lib/pii";
import type { ParsedOrderLine } from "@/lib/platforms/types";
import { type MovementInput, movementBatch } from "@/lib/stock/movements";

export type ImportInput = { platform: Platform; filename: string; lines: ParsedOrderLine[] };

export type ImportSummary = {
  batchId: number;
  orders: number;
  newOrders: number;
  /** Orders whose stock was put back in this import. */
  cancelled: number;
  /** Order items whose stock was deducted in this import. */
  deducted: number;
  /** Items in this file with no matching SKU (manual mapping needed). */
  unmatched: number;
  /** Bundles that matched but have no components, so nothing could be deducted. */
  emptyBundles: string[];
};

const CHUNK = 400; // keep IN (...) lists well under SQLite's variable limit

function chunks<T>(list: readonly T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += CHUNK) out.push(list.slice(i, i + CHUNK));
  return out;
}

const codeKey = (code: string) => code.normalize("NFKC").trim().toUpperCase();
export const itemKey = (skuCode: string | null, name: string | null) => (skuCode ? `sku:${skuCode}` : `name:${name ?? ""}`);
export const itemRef = (platform: string, orderNo: string, key: string) => `${platform}:${orderNo}:${key}`;

type SkuInfo = { id: number; code: string; isBundle: boolean };
type Catalog = { byCode: Map<string, SkuInfo>; byId: Map<number, SkuInfo>; parts: Map<number, { skuId: number; qty: number }[]> };

async function loadCatalog(db: Db): Promise<Catalog> {
  const all = await db.select({ id: skus.id, code: skus.code, isBundle: skus.isBundle }).from(skus);
  const parts = new Map<number, { skuId: number; qty: number }[]>();
  for (const l of await db.select().from(bundleComponents)) {
    parts.set(l.bundleSkuId, [...(parts.get(l.bundleSkuId) ?? []), { skuId: l.componentSkuId, qty: l.qty }]);
  }
  return { byCode: new Map(all.map((s) => [codeKey(s.code), s])), byId: new Map(all.map((s) => [s.id, s])), parts };
}

/** Sale movements for one order item: the SKU itself, or each bundle component. Null if a bundle has no parts. */
function saleMovements(cat: Catalog, ref: string, skuId: number, qty: number): MovementInput[] | null {
  const sku = cat.byId.get(skuId);
  if (!sku) return [];
  const base = { reason: "order", refType: "order_item", refId: ref } as const;
  if (!sku.isBundle) return [{ ...base, skuId, delta: -qty }];
  const parts = cat.parts.get(skuId) ?? [];
  if (parts.length === 0) return null;
  return parts.map((p) => ({ ...base, skuId: p.skuId, delta: -qty * p.qty }));
}

type ExistingMovement = { refId: string | null; skuId: number; delta: number; reason: string };

async function loadMovements(db: Db, refs: string[]): Promise<ExistingMovement[]> {
  const out: ExistingMovement[] = [];
  for (const part of chunks(refs)) {
    out.push(
      ...(await db
        .select({ refId: stockMovements.refId, skuId: stockMovements.skuId, delta: stockMovements.delta, reason: stockMovements.reason })
        .from(stockMovements)
        .where(and(eq(stockMovements.refType, "order_item"), inArray(stockMovements.refId, part)))),
    );
  }
  return out;
}

/** Movements that put back what was sold under `ref` and has not been put back yet. */
function cancelMovements(existing: readonly ExistingMovement[], ref: string): MovementInput[] {
  const mine = existing.filter((m) => m.refId === ref);
  const returned = new Set(mine.filter((m) => m.reason === "cancel").map((m) => m.skuId));
  return mine
    .filter((m) => m.reason === "order" && !returned.has(m.skuId))
    .map((m) => ({ skuId: m.skuId, delta: -m.delta, reason: "cancel", refType: "order_item", refId: ref }));
}

export async function importOrders(db: Db, input: ImportInput): Promise<ImportSummary> {
  assertNoPii(input.lines); // the browser already checked; never trust the client

  // Group lines into orders, and same-SKU lines within an order into one item.
  type Item = { key: string; skuCode: string | null; name: string; qty: number };
  type Order = { orderNo: string; status: string; cancelled: boolean; orderedAt: number | null; items: Map<string, Item> };
  const grouped = new Map<string, Order>();
  for (const l of input.lines) {
    const o = grouped.get(l.orderNo) ?? { orderNo: l.orderNo, status: l.status, cancelled: l.cancelled, orderedAt: l.orderedAt, items: new Map() };
    const key = itemKey(l.skuCode || null, l.name);
    const it = o.items.get(key);
    if (it) it.qty += l.qty;
    else o.items.set(key, { key, skuCode: l.skuCode || null, name: l.name, qty: l.qty });
    grouped.set(l.orderNo, o);
  }

  const cat = await loadCatalog(db);
  const orderNos = [...grouped.keys()];
  const existingOrders = new Map<string, { id: number; status: string }>();
  for (const part of chunks(orderNos)) {
    const rows = await db
      .select({ id: orders.id, no: orders.platformOrderNo, status: orders.status })
      .from(orders)
      .where(and(eq(orders.platform, input.platform), inArray(orders.platformOrderNo, part)));
    for (const r of rows) existingOrders.set(r.no, { id: r.id, status: r.status });
  }
  // Existing items keep their (possibly manually mapped) SKU and qty.
  const existingItems = new Map<string, { skuId: number | null; qty: number }>();
  for (const part of chunks([...existingOrders.values()].map((o) => o.id))) {
    const rows = await db
      .select({ orderId: orderItems.orderId, skuId: orderItems.skuId, code: orderItems.rawSkuCode, name: orderItems.rawName, qty: orderItems.qty })
      .from(orderItems)
      .where(inArray(orderItems.orderId, part));
    for (const r of rows) existingItems.set(`${r.orderId}|${itemKey(r.code, r.name)}`, { skuId: r.skuId, qty: r.qty });
  }
  const refs = [...grouped.values()].flatMap((o) => [...o.items.keys()].map((k) => itemRef(input.platform, o.orderNo, k)));
  const existingMoves = await loadMovements(db, refs);
  const hasSale = (ref: string, skuId: number) =>
    existingMoves.some((m) => m.refId === ref && m.skuId === skuId && m.reason === "order");

  const [batch] = await db
    .insert(importBatches)
    .values({ platform: input.platform, filename: input.filename, rowCount: input.lines.length })
    .returning({ id: importBatches.id });

  const writes = [];
  const moves: MovementInput[] = [];
  const summary: ImportSummary = { batchId: batch.id, orders: grouped.size, newOrders: 0, cancelled: 0, deducted: 0, unmatched: 0, emptyBundles: [] };
  let matchedItems = 0;
  const orderIdSql = (no: string) =>
    sql`(select ${orders.id} from ${orders} where ${orders.platform} = ${input.platform} and ${orders.platformOrderNo} = ${no})`;

  for (const o of grouped.values()) {
    const prev = existingOrders.get(o.orderNo);
    if (!prev) summary.newOrders++;
    writes.push(
      db
        .insert(orders)
        .values({ platform: input.platform, platformOrderNo: o.orderNo, status: o.status, orderedAt: o.orderedAt ? new Date(o.orderedAt) : null, importBatchId: batch.id })
        .onConflictDoUpdate({ target: [orders.platform, orders.platformOrderNo], set: { status: o.status } }),
    );

    let putBack = false;
    for (const item of o.items.values()) {
      const ref = itemRef(input.platform, o.orderNo, item.key);
      const old = prev ? existingItems.get(`${prev.id}|${item.key}`) : undefined;
      const skuId = old ? old.skuId : item.skuCode ? (cat.byCode.get(codeKey(item.skuCode))?.id ?? null) : null;
      const qty = old ? old.qty : item.qty;
      if (!old) {
        writes.push(
          db.insert(orderItems).values({ orderId: orderIdSql(o.orderNo), skuId, rawSkuCode: item.skuCode, rawName: item.name, qty, matched: skuId !== null }),
        );
      }
      if (skuId === null) {
        summary.unmatched++;
        continue;
      }
      matchedItems++;
      if (o.cancelled) {
        const back = cancelMovements(existingMoves, ref);
        if (back.length) putBack = true;
        moves.push(...back);
      } else {
        const sale = saleMovements(cat, ref, skuId, qty);
        if (sale === null) {
          summary.emptyBundles.push(cat.byId.get(skuId)?.code ?? String(skuId));
          continue;
        }
        const fresh = sale.filter((m) => !hasSale(ref, m.skuId));
        if (fresh.length) summary.deducted++;
        moves.push(...fresh);
      }
    }
    if (putBack) summary.cancelled++;
  }

  writes.push(
    db
      .update(importBatches)
      .set({ matchedCount: matchedItems, unmatchedCount: summary.unmatched })
      .where(eq(importBatches.id, batch.id)),
  );
  try {
    await db.batch([writes[0], ...writes.slice(1), ...movementBatch(db, moves)]);
  } catch (e) {
    await db.delete(importBatches).where(eq(importBatches.id, batch.id));
    throw e;
  }
  return summary;
}

export class MappingError extends Error {}

/** Manually maps an unmatched order item to a SKU; deducts stock unless the order is cancelled. */
export async function mapOrderItem(db: Db, orderItemId: number, skuId: number, cancelledStatuses: readonly string[]) {
  const [row] = await db
    .select({ item: orderItems, platform: orders.platform, orderNo: orders.platformOrderNo, status: orders.status })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(eq(orderItems.id, orderItemId));
  if (!row) throw new MappingError("找不到這筆訂單品項。");
  if (row.item.skuId !== null) throw new MappingError("這筆品項已經對應過了。");
  const cat = await loadCatalog(db);
  if (!cat.byId.has(skuId)) throw new MappingError("找不到這個貨號。");

  const ref = itemRef(row.platform, row.orderNo, itemKey(row.item.rawSkuCode, row.item.rawName));
  const cancelled = cancelledStatuses.includes(row.status);
  const sale = cancelled ? [] : saleMovements(cat, ref, skuId, row.item.qty);
  if (sale === null) throw new MappingError("這個組合還沒有設定部件，先到商品頁加入部件。");
  await db.batch([
    db.update(orderItems).set({ skuId, matched: true }).where(eq(orderItems.id, orderItemId)),
    ...movementBatch(db, sale),
  ]);
  return { deducted: sale.length > 0 };
}
