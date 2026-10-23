// Client-side search over the snapshot, so finding goods works offline.
import { bundleAvailable, physicalAvailable } from "@/lib/stock/available";
import type { Snapshot, SnapshotSku } from "./types";

// NFKC folds full-width letters/digits (ＷＳ－ＦＬ) into ASCII; lower-case for codes.
const norm = (s: string) => s.normalize("NFKC").toLowerCase();

/**
 * Every whitespace-separated term must appear in the product name, variant, code or barcode.
 * Exact code/barcode hits come first, then code prefix hits.
 */
export function searchSkus(skus: readonly SnapshotSku[], query: string, limit = 50): SnapshotSku[] {
  const q = norm(query).trim();
  if (!q) return [];
  const terms = q.split(/\s+/);
  const scored: { sku: SnapshotSku; score: number }[] = [];
  for (const sku of skus) {
    if (!sku.active) continue;
    const code = norm(sku.code);
    const barcode = sku.barcode ? norm(sku.barcode) : "";
    const hay = `${norm(sku.productName)} ${norm(sku.variantName ?? "")} ${code} ${barcode}`;
    if (!terms.every((t) => hay.includes(t))) continue;
    const score = q === code || q === barcode ? 0 : code.startsWith(q) ? 1 : 2;
    scored.push({ sku, score });
  }
  scored.sort((a, b) => a.score - b.score);
  return scored.slice(0, limit).map((s) => s.sku);
}

/** Sellable quantity per SKU id, computed from the snapshot's stock. */
export function snapshotAvailability(snapshot: Snapshot): Map<number, number> {
  const stockById = new Map(snapshot.skus.map((s) => [s.id, s.stock]));
  return new Map(
    snapshot.skus.map((s) => [
      s.id,
      s.isBundle
        ? bundleAvailable(s.components.map((c) => ({ stock: stockById.get(c.skuId) ?? 0, qty: c.qty })))
        : physicalAvailable(s.stock),
    ]),
  );
}
