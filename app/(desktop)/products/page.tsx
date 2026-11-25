import { and, asc, eq, exists, inArray, like, or, sql } from "drizzle-orm";
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

const PAGE_SIZE = 50;

export default async function ProductsPage({ searchParams }: PageProps<"/products">) {
  const sp = await searchParams;
  const q = String(sp.q ?? "").trim();
  const page = Math.max(1, Number.parseInt(String(sp.page ?? "1"), 10) || 1);
  const db = getDb();
  // Page over products first, then load only their SKUs (the catalog has thousands of SKUs).
  const match = q
    ? or(
        like(products.name, `%${q}%`),
        exists(db.select({ x: sql`1` }).from(skus).where(and(eq(skus.productId, products.id), like(skus.code, `%${q}%`)))),
      )
    : undefined;
  const [pageIds, available] = await Promise.all([
    db
      .select({ id: products.id })
      .from(products)
      .where(match)
      .orderBy(asc(products.name), asc(products.id))
      .limit(PAGE_SIZE + 1)
      .offset((page - 1) * PAGE_SIZE),
    getAvailability(db),
  ]);
  const hasNext = pageIds.length > PAGE_SIZE;
  const ids = pageIds.slice(0, PAGE_SIZE).map((p) => p.id);
  const rows = ids.length
    ? await db
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
        .where(inArray(products.id, ids))
        .orderBy(asc(products.name), asc(products.id), asc(skus.code))
    : [];
  const pageHref = (n: number) => `/products?${new URLSearchParams({ ...(q ? { q } : {}), page: String(n) })}`;

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
        <div className="flex gap-2">
          <ButtonLink href="/products/import">從平台匯入</ButtonLink>
          <ButtonLink href="/products/new" variant="primary">
            新增商品
          </ButtonLink>
        </div>
      </div>
      <form className="mb-4 max-w-md">
        <Input name="q" type="search" defaultValue={q} placeholder="搜尋商品名、貨號" className="w-full" />
      </form>

      {grouped.size === 0 ? (
        <p className="text-ink-2">{q ? `找不到「${q}」。` : page > 1 ? "這一頁沒有商品。" : "還沒有商品。按「新增商品」或「從平台匯入」建立。"}</p>
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
      {(page > 1 || hasNext) && (
        <nav className="mt-4 flex max-w-5xl items-center gap-3" aria-label="分頁">
          {page > 1 && <ButtonLink href={pageHref(page - 1)}>上一頁</ButtonLink>}
          <span className="text-ink-2">第 {page} 頁</span>
          {hasNext && <ButtonLink href={pageHref(page + 1)}>下一頁</ButtonLink>}
        </nav>
      )}
    </>
  );
}
