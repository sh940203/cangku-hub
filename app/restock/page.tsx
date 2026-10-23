import Link from "next/link";
import { LocationTag } from "@/components/stock/location-tag";
import { StockNumber } from "@/components/stock/stock-number";
import { PageHeader } from "@/components/ui/page-header";
import { getDb } from "@/db";
import { lowStock, restockText } from "@/lib/stock/low-stock";
import { CopyButton } from "./copy-button";

export const dynamic = "force-dynamic";

export default async function RestockPage() {
  const rows = await lowStock(getDb());
  const text = restockText(rows, new Date());

  return (
    <div className="lg:max-w-xl">
      <PageHeader title="叫貨清單" />
      {rows.length === 0 ? (
        <p className="text-ink-2">目前沒有低於安全庫存的貨號。要在這裡出現，先到商品頁幫貨號設定「安全庫存」。</p>
      ) : (
        <div className="space-y-5">
          <ul className="-mx-4 divide-y divide-line border-y border-line bg-surface lg:mx-0">
            {rows.map((r) => (
              <li key={r.id}>
                <Link href={`/find?sku=${r.id}`} className="flex min-h-14 items-center gap-3 px-4 py-2 active:bg-bg">
                  <span className="min-w-0 flex-1">
                    <span className="block">{[r.productName, r.variantName].filter(Boolean).join(" ")}</span>
                    <span className="font-code text-aux font-semibold text-ink-2">{r.code}</span>
                  </span>
                  {r.locationCode && <LocationTag code={r.locationCode} />}
                  <span className="shrink-0 text-right">
                    <StockNumber value={r.stock ?? 0} safety={r.safetyStock} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <CopyButton text={text} />
          <pre className="rounded-control border border-line bg-surface p-3 font-sans text-aux whitespace-pre-wrap text-ink-2 select-all">
            {text}
          </pre>
        </div>
      )}
    </div>
  );
}
