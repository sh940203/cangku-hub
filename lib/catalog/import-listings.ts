// Builds products and SKUs from a platform product export (no SKU codes on the platform yet).
//
// - One platform product → one product; one platform variation → one physical SKU + platform_listings row.
// - Codes: P0001 for a single-variation product, P0002-01, P0002-02 … otherwise. Numbers continue from the
//   highest P code already in the system.
// - Initial stock is the platform's stock, written as an `initial` movement keyed by the variation ID, so
//   importing the same file again creates nothing and adds no stock. Variations already linked are skipped:
//   from then on our stock is the source of truth, not the platform's.
// - A variation whose platform SKU code equals an existing, unlinked SKU code is linked to that SKU instead.
import { and, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { type Platform, platformListings, products, skus, stockMovements } from "@/db/schema";
import type { ListingLine } from "@/lib/platforms/types";

export type ListingImportSummary = {
  newProducts: number;
  newSkus: number;
  /** Variations linked to an SKU that already had the same code. */
  linked: number;
  /** Variations already in the system; left untouched. */
  existing: number;
  /** Sum of initial stock written. */
  stockAdded: number;
};

const CODE = /^P(\d+)(?:-(\d+))?$/;
const PRODUCTS_PER_BATCH = 100;
const CHUNK = 400;

export const productCodeOf = (skuCode: string) => CODE.exec(skuCode) ? `P${CODE.exec(skuCode)![1]}` : "";
export const listingRef = (platform: string, variantId: string) => `${platform}:listing:${variantId}`;
const pad = (n: number, w: number) => String(n).padStart(w, "0");

function chunks<T>(list: readonly T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

export async function importListings(
  db: Db,
  input: { platform: Platform; lines: readonly ListingLine[] },
): Promise<ListingImportSummary> {
  const { platform, lines } = input;
  const [allSkus, links] = await Promise.all([
    db.select({ id: skus.id, code: skus.code, productId: skus.productId, isBundle: skus.isBundle }).from(skus),
    db
      .select({
        skuId: platformListings.skuId,
        itemId: platformListings.platformItemId,
        variantId: platformListings.platformVariantId,
      })
      .from(platformListings)
      .where(eq(platformListings.platform, platform)),
  ]);
  const skuById = new Map(allSkus.map((s) => [s.id, s]));
  const skuByCode = new Map(allSkus.map((s) => [s.code.normalize("NFKC").trim().toUpperCase(), s]));
  const linkedSku = new Set(links.map((l) => l.skuId));
  const linkedVariant = new Set(links.map((l) => l.variantId));
  const productOfItem = new Map<string, number>();
  for (const l of links) {
    const s = skuById.get(l.skuId);
    if (l.itemId && s) productOfItem.set(l.itemId, s.productId);
  }

  // Highest product number, and highest variation suffix per product (a bare P0001 counts as 01).
  let lastNo = 0;
  const prefixOf = new Map<number, string>();
  const lastSuffix = new Map<number, number>();
  for (const s of allSkus) {
    const m = CODE.exec(s.code);
    if (!m) continue;
    lastNo = Math.max(lastNo, Number(m[1]));
    prefixOf.set(s.productId, `P${m[1]}`);
    lastSuffix.set(s.productId, Math.max(lastSuffix.get(s.productId) ?? 0, m[2] ? Number(m[2]) : 1));
  }
  const width = (n: number) => Math.max(4, String(n).length);

  const byItem = new Map<string, ListingLine[]>();
  for (const l of lines) byItem.set(l.itemId, [...(byItem.get(l.itemId) ?? []), l]);

  const summary: ListingImportSummary = { newProducts: 0, newSkus: 0, linked: 0, existing: 0, stockAdded: 0 };
  type Plan = { name: string; productId: number | null; skus: { code: string; line: ListingLine }[]; link: { skuId: number; line: ListingLine }[] };
  const plans: Plan[] = [];

  for (const [itemId, variants] of byItem) {
    const plan: Plan = { name: variants[0].itemName || itemId, productId: productOfItem.get(itemId) ?? null, skus: [], link: [] };
    const fresh: ListingLine[] = [];
    for (const v of variants) {
      if (linkedVariant.has(v.variantId)) {
        summary.existing++;
        continue;
      }
      const same = v.skuCode ? skuByCode.get(v.skuCode.normalize("NFKC").trim().toUpperCase()) : undefined;
      if (same && !same.isBundle && !linkedSku.has(same.id)) {
        plan.link.push({ skuId: same.id, line: v });
        linkedSku.add(same.id);
        summary.linked++;
        continue;
      }
      fresh.push(v);
    }
    if (fresh.length) {
      if (plan.productId === null) {
        lastNo++;
        const prefix = `P${pad(lastNo, width(lastNo))}`;
        const single = variants.length === 1 && !fresh[0].variantName;
        fresh.forEach((v, i) => plan.skus.push({ code: single ? prefix : `${prefix}-${pad(i + 1, 2)}`, line: v }));
        summary.newProducts++;
      } else {
        const pid = plan.productId;
        const prefix = prefixOf.get(pid) ?? `P${pad(++lastNo, width(lastNo))}`;
        prefixOf.set(pid, prefix);
        let n = lastSuffix.get(pid) ?? 0;
        for (const v of fresh) plan.skus.push({ code: `${prefix}-${pad(++n, 2)}`, line: v });
        lastSuffix.set(pid, n);
      }
      summary.newSkus += fresh.length;
    }
    if (plan.skus.length || plan.link.length) plans.push(plan);
  }

  const skuIdOf = (code: string) => sql`(select ${skus.id} from ${skus} where ${skus.code} = ${code})`;
  // Each batch is atomic and holds whole products, so a failed import can simply be run again.
  for (const part of chunks(plans, PRODUCTS_PER_BATCH)) {
    const writes = [];
    const touched: string[] = [];
    const linkedIds: number[] = [];
    for (const p of part) {
      if (p.skus.length) {
        const productId = p.productId ?? sql`(select max(${products.id}) from ${products})`;
        if (p.productId === null) writes.push(db.insert(products).values({ name: p.name }));
        writes.push(
          db.insert(skus).values(
            p.skus.map((s) => ({ code: s.code, productId, variantName: s.line.variantName || null, stock: 0 })),
          ),
        );
      }
      const listingRows = [
        ...p.skus.map((s) => ({ skuId: skuIdOf(s.code), line: s.line })),
        ...p.link.map((l) => ({ skuId: l.skuId, line: l.line })),
      ];
      writes.push(
        db.insert(platformListings).values(
          listingRows.map((r) => ({ skuId: r.skuId, platform, platformItemId: r.line.itemId, platformVariantId: r.line.variantId })),
        ),
      );
      const stocked = p.skus.filter((s) => s.line.stock > 0);
      if (stocked.length) {
        writes.push(
          db
            .insert(stockMovements)
            .values(
              stocked.map((s) => ({
                skuId: skuIdOf(s.code),
                delta: s.line.stock,
                reason: "initial" as const,
                refType: "import_batch" as const,
                refId: listingRef(platform, s.line.variantId),
              })),
            )
            .onConflictDoNothing(),
        );
        summary.stockAdded += stocked.reduce((n, s) => n + s.line.stock, 0);
      }
      touched.push(...p.skus.map((s) => s.code));
      linkedIds.push(...p.link.map((l) => l.skuId));
    }
    // Rebuild the stock cache of the new SKUs from their movements.
    if (touched.length) {
      writes.push(
        db
          .update(skus)
          .set({
            stock: sql`(select coalesce(sum(${stockMovements.delta}), 0) from ${stockMovements} where ${stockMovements.skuId} = "skus"."id")`,
          })
          .where(inArray(skus.code, touched)),
      );
    }
    await db.batch([writes[0], ...writes.slice(1)]);
  }
  return summary;
}

/** Our SKU code (and product code) for each linked platform variation. */
export async function listingCodes(db: Db, platform: Platform, variantIds: readonly string[]) {
  const out = new Map<string, { skuCode: string; productCode: string; stock: number | null }>();
  for (const part of chunks([...new Set(variantIds)])) {
    const rows = await db
      .select({ variantId: platformListings.platformVariantId, code: skus.code, stock: skus.stock })
      .from(platformListings)
      .innerJoin(skus, eq(skus.id, platformListings.skuId))
      .where(and(eq(platformListings.platform, platform), inArray(platformListings.platformVariantId, part)));
    for (const r of rows) if (r.variantId) out.set(r.variantId, { skuCode: r.code, productCode: productCodeOf(r.code), stock: r.stock });
  }
  return out;
}
