import { and, asc, eq, like, or } from "drizzle-orm";
import Link from "next/link";
import { LocationTag } from "@/components/stock/location-tag";
import { StockNumber } from "@/components/stock/stock-number";
import { Input } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { getDb } from "@/db";
import { locations, products, skus } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function StocktakePage({ searchParams }: PageProps<"/stocktake">) {
  const q = String((await searchParams).q ?? "").trim();
  const rows = q
    ? await getDb()
        .select({
          id: skus.id,
          code: skus.code,
          variantName: skus.variantName,
          stock: skus.stock,
          safetyStock: skus.safetyStock,
          productName: products.name,
          locationCode: locations.code,
        })
        .from(skus)
        .innerJoin(products, eq(products.id, skus.productId))
        .leftJoin(locations, eq(locations.id, skus.locationId))
        .where(
          and(
            eq(skus.isBundle, false),
            eq(skus.status, "active"),
            or(like(products.name, `%${q}%`), like(skus.code, `%${q}%`), eq(skus.barcode, q), like(skus.variantName, `%${q}%`)),
          ),
        )
        .orderBy(asc(products.name), asc(skus.code))
        .limit(50)
    : [];

  return (
    <>
      <PageHeader title="盤點" />
      <form className="mb-4">
        <Input name="q" type="search" defaultValue={q} placeholder="搜尋商品名、貨號、條碼" autoFocus enterKeyHint="search" className="w-full" />
      </form>
      {!q ? (
        <p className="text-ink-2">輸入商品名或貨號，找到要盤點的貨號。</p>
      ) : rows.length === 0 ? (
        <p className="text-ink-2">找不到「{q}」。組合商品不用盤點，請盤它的部件。</p>
      ) : (
        <ul className="-mx-4 divide-y divide-line border-y border-line bg-surface lg:mx-0">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/stocktake/${r.id}`} className="flex min-h-14 items-center gap-3 px-4 py-2">
                <span className="flex-1">
                  <span className="block">
                    {r.productName} {r.variantName}
                  </span>
                  <span className="font-code font-semibold text-aux text-ink-2">{r.code}</span>
                </span>
                {r.locationCode && <LocationTag code={r.locationCode} />}
                <span className="w-12 text-right">
                  <StockNumber value={r.stock ?? 0} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
