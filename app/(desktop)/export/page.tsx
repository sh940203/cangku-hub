import Link from "next/link";
import { StockNumber } from "@/components/stock/stock-number";
import { PageHeader } from "@/components/ui/page-header";
import { getDb } from "@/db";
import { adapters } from "@/lib/platforms";
import { pendingPushes } from "@/lib/sync/push";
import { PushForm } from "./push-form";

export const dynamic = "force-dynamic";

export default async function ExportPage() {
  const platform = Object.values(adapters).find((a) => a.listings);
  if (!platform?.listings) {
    return (
      <>
        <PageHeader title="批次匯出" />
        <p className="text-ink-2">目前沒有可以更新庫存的平台。</p>
      </>
    );
  }
  const pending = await pendingPushes(getDb(), platform.id);

  return (
    <>
      <PageHeader title={`更新${platform.label}庫存`} />
      <div className="max-w-5xl space-y-8">
        <section>
          <h2 className="mb-1 text-section">待更新 {pending.length} 個規格</h2>
          {pending.length === 0 ? (
            <p className="text-ink-2">{platform.label}上的庫存和系統一致，不用更新。</p>
          ) : (
            <>
              <p className="mb-3 text-aux text-ink-2">系統可售量和上次上傳到{platform.label}的數字不同。</p>
              <table className="w-full border-y border-line bg-surface text-left">
                <thead className="text-aux text-ink-2">
                  <tr className="border-b border-line">
                    <th className="px-3 py-2 font-normal">貨號</th>
                    <th className="px-3 py-2 font-normal">商品／規格</th>
                    <th className="px-3 py-2 text-right font-normal whitespace-nowrap">上次上傳</th>
                    <th className="px-3 py-2 text-right font-normal whitespace-nowrap">現在可售</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {pending.slice(0, 200).map((p) => (
                    <tr key={p.skuId} className="h-12">
                      <td className="px-3 font-code font-semibold whitespace-nowrap text-tag">{p.code}</td>
                      <td className="px-3">
                        <Link href={`/products/${p.productId}/skus/${p.skuId}`} className="hover:underline">
                          {p.variantName ?? p.productName}
                        </Link>
                        {p.isBundle && <span className="ml-2 text-aux text-ink-2">組合</span>}
                        {p.variantName && <span className="ml-2 text-aux text-ink-2">{p.productName}</span>}
                      </td>
                      <td className="px-3 text-right font-code text-ink-2">{p.lastPushed ?? "—"}</td>
                      <td className="px-3 text-right">
                        <StockNumber value={p.available} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {pending.length > 200 && <p className="mt-2 text-aux text-ink-2">只列出前 200 個。</p>}
            </>
          )}
        </section>

        <PushForm platform={{ id: platform.id, label: platform.label, howToGet: platform.listings.howToGet }} />
      </div>
    </>
  );
}
