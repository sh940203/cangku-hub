import { asc, desc, eq, isNull } from "drizzle-orm";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Select } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { getDb } from "@/db";
import { importBatches, orderItems, orders, products, skus } from "@/db/schema";
import { adapters } from "@/lib/platforms";
import { mapItemAction } from "./actions";
import { ImportForm } from "./import-form";

export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", dateStyle: "short", timeStyle: "short" });

export default async function ImportPage() {
  const db = getDb();
  const platforms = Object.values(adapters).map((a) => ({ id: a.id, label: a.label, ready: a.ready }));
  const labelOf = (id: string) => adapters[id as keyof typeof adapters]?.label ?? id;

  const unmatched = await db
    .select({
      id: orderItems.id,
      rawSkuCode: orderItems.rawSkuCode,
      rawName: orderItems.rawName,
      qty: orderItems.qty,
      orderNo: orders.platformOrderNo,
      platform: orders.platform,
      status: orders.status,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(isNull(orderItems.skuId))
    .orderBy(desc(orders.orderedAt))
    .limit(200);

  const skuOptions = unmatched.length
    ? await db
        .select({ id: skus.id, code: skus.code, variantName: skus.variantName, productName: products.name })
        .from(skus)
        .innerJoin(products, eq(products.id, skus.productId))
        .where(eq(skus.status, "active"))
        .orderBy(asc(products.name), asc(skus.code))
    : [];

  const batches = await db.select().from(importBatches).orderBy(desc(importBatches.id)).limit(10);

  return (
    <>
      <PageHeader title="訂單匯入" />
      <ImportForm platforms={platforms} />

      <section className="mt-10 max-w-5xl">
        <h2 className="mb-1 text-section">未對應品項</h2>
        {unmatched.length === 0 ? (
          <p className="text-ink-2">目前沒有對不到貨號的品項。</p>
        ) : (
          <>
            <p className="mb-3 text-aux text-ink-2">
              有 {unmatched.length} 項貨號對不到商品，請手動對應。之後要少一點這種情況，可以把平台上的規格貨號改成系統裡的貨號。
            </p>
            <ul className="divide-y divide-line border-y border-line bg-surface">
              {unmatched.map((u) => (
                <li key={u.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
                  <span className="min-w-60 flex-1">
                    <span className="block">「{u.rawName}」× {u.qty}</span>
                    <span className="text-aux text-ink-2">
                      {labelOf(u.platform)} {u.orderNo}・貨號 {u.rawSkuCode ?? "（空白）"}・{u.status}
                    </span>
                  </span>
                  <ActionForm action={mapItemAction.bind(null, u.id, u.platform)} className="flex flex-wrap items-center gap-2">
                    <Select name="skuId" defaultValue="" required aria-label="對應到貨號" className="w-72">
                      <option value="" disabled>
                        選擇貨號
                      </option>
                      {skuOptions.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.code}　{s.productName} {s.variantName ?? ""}
                        </option>
                      ))}
                    </Select>
                    <SubmitButton>對應</SubmitButton>
                  </ActionForm>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {batches.length > 0 && (
        <section className="mt-10 max-w-5xl">
          <h2 className="mb-2 text-section">最近匯入</h2>
          <table className="w-full border-y border-line bg-surface text-left">
            <thead className="text-aux text-ink-2">
              <tr className="border-b border-line">
                <th className="px-3 py-2 font-normal">時間</th>
                <th className="px-3 py-2 font-normal">平台</th>
                <th className="px-3 py-2 font-normal">檔名</th>
                <th className="px-3 py-2 text-right font-normal">列數</th>
                <th className="px-3 py-2 text-right font-normal">未對應</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {batches.map((b) => (
                <tr key={b.id} className="h-12">
                  <td className="px-3 text-aux text-ink-2">{dateFmt.format(b.createdAt)}</td>
                  <td className="px-3">{labelOf(b.platform)}</td>
                  <td className="px-3">{b.filename}</td>
                  <td className="px-3 text-right font-code font-semibold">{b.rowCount}</td>
                  <td className={`px-3 text-right font-code font-semibold ${b.unmatchedCount ? "text-warn" : ""}`}>{b.unmatchedCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
