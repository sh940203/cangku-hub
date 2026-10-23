import { asc, eq, like, or } from "drizzle-orm";
import Link from "next/link";
import { LocationTag } from "@/components/stock/location-tag";
import { StockNumber } from "@/components/stock/stock-number";
import { ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { getDb } from "@/db";
import { locations, products, skus } from "@/db/schema";
import { getAvailability } from "@/lib/stock/queries";

export const dynamic = "force-dynamic";

export default async function ProductsPage({ searchParams }: PageProps<"/products">) {
  const q = String((await searchParams).q ?? "").trim();
  const db = getDb();
  const [rows, available] = await Promise.all([
    db
      .select({
        productId: products.id,
        productName: products.name,
        category: products.category,
        skuId: skus.id,
        code: skus.code,
        variantName: skus.variantName,
        isBundle: skus.isBundle,
        status: skus.status,
        safetyStock: skus.safetyStock,
        locationCode: locations.code,
      })
      .from(products)
      .leftJoin(skus, eq(skus.productId, products.id))
      .leftJoin(locations, eq(locations.id, skus.locationId))
      .where(q ? or(like(products.name, `%${q}%`), like(skus.code, `%${q}%`)) : undefined)
      .orderBy(asc(products.name), asc(skus.code)),
    getAvailability(db),
  ]);

  const grouped = new Map<number, { name: string; category: string | null; skus: typeof rows }>();
  for (const r of rows) {
    const g = grouped.get(r.productId) ?? { name: r.productName, category: r.category, skus: [] };
    if (r.skuId !== null) g.skus.push(r);
    grouped.set(r.productId, g);
  }

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <PageHeader title="商品" />
        <ButtonLink href="/products/new" variant="primary">
          新增商品
        </ButtonLink>
      </div>
      <form className="mb-4 max-w-md">
        <Input name="q" type="search" defaultValue={q} placeholder="搜尋商品名、貨號" className="w-full" />
      </form>

      {grouped.size === 0 ? (
        <p className="text-ink-2">{q ? `找不到「${q}」。` : "還沒有商品。按「新增商品」建立第一個。"}</p>
      ) : (
        <table className="w-full max-w-5xl border-y border-line bg-surface">
          <thead className="text-left text-aux text-ink-2">
            <tr className="border-b border-line">
              <th className="px-3 py-2 font-normal">商品／規格</th>
              <th className="px-3 py-2 font-normal">貨號</th>
              <th className="px-3 py-2 font-normal">儲位</th>
              <th className="px-3 py-2 text-right font-normal">可售</th>
            </tr>
          </thead>
          {[...grouped.entries()].map(([id, g]) => (
            <tbody key={id} className="divide-y divide-line border-b border-line">
              <tr className="h-14">
                <td colSpan={4} className="px-3">
                  <Link href={`/products/${id}`} className="font-medium hover:underline">
                    {g.name}
                  </Link>
                  {g.category && <span className="ml-2 text-aux text-ink-2">{g.category}</span>}
                  {g.skus.length === 0 && <span className="ml-2 text-aux text-ink-2">還沒有貨號</span>}
                </td>
              </tr>
              {g.skus.map((s) => (
                <tr key={s.skuId} className={`h-14 ${s.status === "archived" ? "text-ink-2" : ""}`}>
                  <td className="pr-3 pl-8">
                    <Link href={`/products/${id}/skus/${s.skuId}`} className="hover:underline">
                      {s.variantName ?? "（未命名規格）"}
                    </Link>
                    {s.isBundle && <span className="ml-2 text-aux text-ink-2">組合</span>}
                    {s.status === "archived" && <span className="ml-2 text-aux">已封存</span>}
                  </td>
                  <td className="px-3 font-code font-semibold text-tag">{s.code}</td>
                  <td className="px-3">{s.locationCode && <LocationTag code={s.locationCode} />}</td>
                  <td className="px-3 text-right">
                    <StockNumber value={available.get(s.skuId!) ?? 0} safety={s.isBundle ? null : s.safetyStock} />
                  </td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      )}
    </>
  );
}
