import { and, asc, desc, eq, ne } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LocationTag } from "@/components/stock/location-tag";
import { StockNumber } from "@/components/stock/stock-number";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { ButtonLink } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { getDb } from "@/db";
import { bundleComponents, locations, products, skus, stockMovements } from "@/db/schema";
import { MOVEMENT_REASON_LABEL } from "@/lib/stock/labels";
import { getAvailability } from "@/lib/stock/queries";
import { addComponent, deleteSku, removeComponent, updateComponentQty, updateSku } from "../../../actions";
import { SkuCommonFields, SkuPhysicalFields } from "../../../sku-fields";

export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("zh-TW", {
  timeZone: "Asia/Taipei",
  dateStyle: "short",
  timeStyle: "short",
});

export default async function SkuPage({ params }: PageProps<"/products/[id]/skus/[skuId]">) {
  const { id: idParam, skuId: skuParam } = await params;
  const productId = Number(idParam);
  const skuId = Number(skuParam);
  const db = getDb();
  if (!Number.isInteger(productId) || !Number.isInteger(skuId)) notFound();
  const [[row], availability, locationOptions] = await Promise.all([
    db
      .select({ sku: skus, productName: products.name })
      .from(skus)
      .innerJoin(products, eq(products.id, skus.productId))
      .where(and(eq(skus.id, skuId), eq(skus.productId, productId))),
    getAvailability(db, [skuId]),
    db.select({ id: locations.id, code: locations.code }).from(locations).orderBy(asc(locations.code)),
  ]);
  if (!row) notFound();
  const { sku, productName } = row;
  const available = availability.get(sku.id) ?? 0;

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <Link href={`/products/${productId}`} className="text-aux text-action hover:underline">
          ‹ {productName}
        </Link>
        <PageHeader title={`${sku.variantName ?? sku.code}${sku.isBundle ? "（組合）" : ""}`} />
        <div className="flex items-center gap-4">
          <span className="font-code font-semibold text-tag">{sku.code}</span>
          <span className="text-ink-2">可售</span>
          <StockNumber value={available} safety={sku.isBundle ? null : sku.safetyStock} size="lg" />
          {!sku.isBundle && (
            <ButtonLink href={`/stocktake/${sku.id}`} className="ml-auto">
              盤點這個貨號
            </ButtonLink>
          )}
        </div>
      </div>

      {sku.isBundle ? <BundleSection bundleSkuId={sku.id} /> : <MovementsSection skuId={sku.id} />}

      <section className="border-t border-line pt-6">
        <h2 className="mb-2 text-section">貨號資料</h2>
        <ActionForm action={updateSku.bind(null, sku.id)}>
          <SkuCommonFields initial={sku} />
          {!sku.isBundle && <SkuPhysicalFields initial={sku} locations={locationOptions} />}
          <div className="grid gap-3 lg:grid-cols-3">
            <Field label="狀態">
              <Select name="status" defaultValue={sku.status}>
                <option value="active">使用中</option>
                <option value="archived">封存</option>
              </Select>
            </Field>
          </div>
          <SubmitButton>儲存貨號</SubmitButton>
        </ActionForm>
      </section>

      <section className="border-t border-line pt-6">
        <ActionForm action={deleteSku.bind(null, productId, sku.id)} confirmText={`刪除貨號 ${sku.code}？`}>
          <SubmitButton variant="danger">刪除貨號</SubmitButton>
        </ActionForm>
      </section>
    </div>
  );
}

async function BundleSection({ bundleSkuId }: { bundleSkuId: number }) {
  const db = getDb();
  const [parts, candidates] = await Promise.all([
    db
      .select({
        componentSkuId: bundleComponents.componentSkuId,
        qty: bundleComponents.qty,
        code: skus.code,
        variantName: skus.variantName,
        stock: skus.stock,
        productName: products.name,
        locationCode: locations.code,
      })
      .from(bundleComponents)
      .innerJoin(skus, eq(skus.id, bundleComponents.componentSkuId))
      .innerJoin(products, eq(products.id, skus.productId))
      .leftJoin(locations, eq(locations.id, skus.locationId))
      .where(eq(bundleComponents.bundleSkuId, bundleSkuId))
      .orderBy(asc(skus.code)),
    db
      .select({ id: skus.id, code: skus.code, variantName: skus.variantName, productName: products.name })
      .from(skus)
      .innerJoin(products, eq(products.id, skus.productId))
      .where(and(eq(skus.isBundle, false), eq(skus.status, "active"), ne(skus.id, bundleSkuId)))
      .orderBy(asc(products.name), asc(skus.code)),
  ]);
  const used = new Set(parts.map((p) => p.componentSkuId));

  return (
    <section>
      <h2 className="mb-1 text-section">部件</h2>
      <p className="mb-3 text-aux text-ink-2">
        可售量 = 每個部件「庫存 ÷ 數量」取整數後的最小值。賣出組合時扣的是部件庫存。
      </p>
      {parts.length === 0 ? (
        <p className="mb-4 text-ink-2">還沒有部件，現在無法販售。在下面加入第一個部件。</p>
      ) : (
        <ul className="mb-4 divide-y divide-line border-y border-line bg-surface">
          {parts.map((p) => (
            <li key={p.componentSkuId} className="flex min-h-14 flex-wrap items-center gap-3 px-3 py-2">
              <span className="w-28 font-code font-semibold text-tag">{p.code}</span>
              <span className="min-w-32 flex-1">
                {p.variantName ?? p.productName}
                <span className="ml-2 text-aux text-ink-2">
                  庫存 {p.stock ?? 0} → 可湊 {Math.floor(Math.max(0, p.stock ?? 0) / p.qty)} 組
                </span>
              </span>
              {p.locationCode && <LocationTag code={p.locationCode} />}
              <ActionForm
                action={updateComponentQty.bind(null, bundleSkuId, p.componentSkuId)}
                className="flex items-center gap-2"
              >
                <label className="text-aux text-ink-2" htmlFor={`qty-${p.componentSkuId}`}>
                  數量
                </label>
                <Input
                  id={`qty-${p.componentSkuId}`}
                  name="qty"
                  defaultValue={p.qty}
                  inputMode="numeric"
                  className="w-16"
                />
                <SubmitButton variant="text">更新</SubmitButton>
              </ActionForm>
              <ActionForm action={removeComponent.bind(null, bundleSkuId, p.componentSkuId)} className="contents">
                <SubmitButton variant="text">移除</SubmitButton>
              </ActionForm>
            </li>
          ))}
        </ul>
      )}

      <ActionForm action={addComponent.bind(null, bundleSkuId)}>
        <div className="grid gap-3 lg:grid-cols-[1fr_6rem_auto] lg:items-end">
          <Field label="加入部件">
            <Select name="componentSkuId" defaultValue="" required>
              <option value="" disabled>
                選擇實體貨號
              </option>
              {candidates
                .filter((c) => !used.has(c.id))
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code}　{c.productName} {c.variantName ?? ""}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="數量">
            <Input name="qty" defaultValue="1" inputMode="numeric" />
          </Field>
          <SubmitButton variant="primary">加入部件</SubmitButton>
        </div>
      </ActionForm>
    </section>
  );
}

async function MovementsSection({ skuId }: { skuId: number }) {
  const rows = await getDb()
    .select()
    .from(stockMovements)
    .where(eq(stockMovements.skuId, skuId))
    .orderBy(desc(stockMovements.id))
    .limit(20);
  return (
    <section>
      <h2 className="mb-2 text-section">最近異動</h2>
      {rows.length === 0 ? (
        <p className="text-ink-2">還沒有任何異動。</p>
      ) : (
        <table className="w-full border-y border-line bg-surface">
          <tbody className="divide-y divide-line">
            {rows.map((m) => (
              <tr key={m.id} className="h-12">
                <td className="px-3 text-aux text-ink-2">{dateFmt.format(m.createdAt)}</td>
                <td className="px-3">{MOVEMENT_REASON_LABEL[m.reason]}</td>
                <td className="px-3 text-ink-2">{m.note}</td>
                <td className="px-3 text-right font-code font-semibold text-tag">
                  {m.delta > 0 ? `+${m.delta}` : m.delta}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
