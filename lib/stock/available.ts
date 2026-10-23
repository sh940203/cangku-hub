// Sellable quantity. Pure functions; no DB access.

export type ComponentStock = { stock: number | null; qty: number };

/** Sellable quantity of a physical SKU. Negative stock (oversold) counts as 0. */
export function physicalAvailable(stock: number | null): number {
  return Math.max(0, stock ?? 0);
}

/**
 * Sellable quantity of a bundle = min over components of floor(component stock / qty).
 * A bundle with no components cannot be sold.
 */
export function bundleAvailable(components: readonly ComponentStock[]): number {
  if (components.length === 0) return 0;
  let min = Infinity;
  for (const c of components) {
    if (!Number.isInteger(c.qty) || c.qty < 1) {
      throw new Error(`invalid component qty: ${c.qty}`);
    }
    min = Math.min(min, Math.floor(physicalAvailable(c.stock) / c.qty));
  }
  return min;
}
