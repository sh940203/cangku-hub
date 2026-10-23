import { and, asc, eq, isNotNull, lt } from "drizzle-orm";
import type { Db } from "@/db";
import { locations, products, skus } from "@/db/schema";

/** Physical, active SKUs below their safety stock (docs/系統結構規劃.md §5.7). */
export function lowStock(db: Db) {
  return db
    .select({
      id: skus.id,
      code: skus.code,
      variantName: skus.variantName,
      productName: products.name,
      stock: skus.stock,
      safetyStock: skus.safetyStock,
      locationCode: locations.code,
    })
    .from(skus)
    .innerJoin(products, eq(products.id, skus.productId))
    .leftJoin(locations, eq(locations.id, skus.locationId))
    .where(
      and(eq(skus.isBundle, false), eq(skus.status, "active"), isNotNull(skus.safetyStock), lt(skus.stock, skus.safetyStock)),
    )
    .orderBy(asc(products.name), asc(skus.code));
}

export type LowStockRow = Awaited<ReturnType<typeof lowStock>>[number];

/** Plain text for pasting into LINE. */
export function restockText(rows: readonly LowStockRow[], today: Date): string {
  const date = new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", month: "numeric", day: "numeric" }).format(today);
  const lines = rows.map(
    (r) => `・${[r.productName, r.variantName].filter(Boolean).join(" ")}（${r.code}）現有 ${r.stock ?? 0}，安全 ${r.safetyStock}`,
  );
  return [`叫貨清單 ${date}`, ...lines].join("\n");
}
