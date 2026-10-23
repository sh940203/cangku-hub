import { count, isNull } from "drizzle-orm";
import Link from "next/link";
import { LocationTag } from "@/components/stock/location-tag";
import { StockNumber } from "@/components/stock/stock-number";
import { PageHeader } from "@/components/ui/page-header";
import { getDb } from "@/db";
import { orderItems } from "@/db/schema";
import { todayLinks } from "@/lib/nav";
import { lowStock } from "@/lib/stock/low-stock";

export const dynamic = "force-dynamic";

const LOW_PREVIEW = 5;

export default async function TodayPage() {
  const db = getDb();
  const [low, [{ n: unmatched }]] = await Promise.all([
    lowStock(db),
    db.select({ n: count() }).from(orderItems).where(isNull(orderItems.skuId)),
  ]);

  return (
    <>
      <PageHeader title="今日" />

      <div className="-mx-4 mb-4 grid grid-cols-2 divide-x divide-line border-y border-line bg-surface lg:mx-0 lg:max-w-xl">
        <Link href="/restock" className="block px-4 py-3 active:bg-bg">
          <span className="block text-aux text-ink-2">待叫貨</span>
          <span className={`block font-code text-number font-semibold ${low.length ? "text-warn" : ""}`}>{low.length}</span>
        </Link>
        <Link href="/import" className="block px-4 py-3 active:bg-bg">
          <span className="block text-aux text-ink-2">訂單未對應</span>
          <span className={`block font-code text-number font-semibold ${unmatched ? "text-warn" : ""}`}>{unmatched}</span>
        </Link>
      </div>

      {low.length > 0 && (
        <section className="mb-6 lg:max-w-xl">
          <h2 className="mb-2 text-section">低於安全庫存</h2>
          <ul className="-mx-4 divide-y divide-line border-y border-line bg-surface lg:mx-0">
            {low.slice(0, LOW_PREVIEW).map((r) => (
              <li key={r.id}>
                <Link href={`/find?sku=${r.id}`} className="flex min-h-14 items-center gap-3 px-4 py-2 active:bg-bg">
                  <span className="min-w-0 flex-1">
                    <span className="block">{[r.productName, r.variantName].filter(Boolean).join(" ")}</span>
                    <span className="font-code text-aux font-semibold text-ink-2">{r.code}</span>
                  </span>
                  {r.locationCode && <LocationTag code={r.locationCode} />}
                  <span className="w-10 text-right">
                    <StockNumber value={r.stock ?? 0} safety={r.safetyStock} hint={false} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {low.length > LOW_PREVIEW && (
            <Link href="/restock" className="mt-2 inline-flex min-h-12 items-center text-action">
              看全部 {low.length} 項叫貨清單 ›
            </Link>
          )}
        </section>
      )}

      <ul className="-mx-4 divide-y divide-line border-y border-line bg-surface lg:mx-0 lg:max-w-xl">
        {todayLinks.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className="flex min-h-14 items-center justify-between px-4 active:bg-bg">
              {item.label}
              <span aria-hidden="true" className="text-ink-2">
                ›
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
