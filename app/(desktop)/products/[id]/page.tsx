import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LocationTag } from "@/components/stock/location-tag";
import { StockNumber } from "@/components/stock/stock-number";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { getDb } from "@/db";
import { locations, products, skus } from "@/db/schema";
import { getAvailability } from "@/lib/stock/queries";
import { createSku, deleteProduct, updateProduct } from "../actions";
import { ProductFields } from "../product-fields";
import { SkuCreateForm } from "./sku-create-form";

export const dynamic = "force-dynamic";

export default async function ProductPage({ params }: PageProps<"/products/[id]">) {
  const id = Number((await params).id);
  const db = getDb();
  const [product] = Number.isInteger(id) ? await db.select().from(products).where(eq(products.id, id)) : [];
  if (!product) notFound();

  const skuRows = await db
    .select({
      id: skus.id,
      code: skus.code,
      variantName: skus.variantName,
      isBundle: skus.isBundle,
      status: skus.status,
      safetyStock: skus.safetyStock,
      locationCode: locations.code,
    })
    .from(skus)
    .leftJoin(locations, eq(locations.id, skus.locationId))
    .where(eq(skus.productId, id))
    .orderBy(asc(skus.code));
  const available = await getAvailability(
    db,
    skuRows.map((s) => s.id),
  );
  const locationOptions = await db
    .select({ id: locations.id, code: locations.code })
    .from(locations)
    .orderBy(asc(locations.code));

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <Link href="/products" className="text-aux text-action hover:underline">
          ‹ 商品
        </Link>
        <PageHeader title={product.name} />
      </div>

      <section>
        <h2 className="mb-2 text-section">貨號</h2>
        {skuRows.length === 0 ? (
          <p className="text-ink-2">還沒有貨號。在下面新增，例如「前左」或「一車份」。</p>
        ) : (
          <ul className="divide-y divide-line border-y border-line bg-surface">
            {skuRows.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/products/${id}/skus/${s.id}`}
                  className={`flex min-h-14 items-center gap-3 px-3 hover:bg-bg active:bg-bg ${s.status === "archived" ? "text-ink-2" : ""}`}
                >
                  <span className="w-28 font-code font-semibold text-tag">{s.code}</span>
                  <span className="flex-1">
                    {s.variantName ?? "（未命名規格）"}
                    {s.isBundle && <span className="ml-2 text-aux text-ink-2">組合</span>}
                    {s.status === "archived" && <span className="ml-2 text-aux">已封存</span>}
                  </span>
                  {s.locationCode && <LocationTag code={s.locationCode} />}
                  <span className="w-28 text-right">
                    <StockNumber value={available.get(s.id) ?? 0} safety={s.isBundle ? null : s.safetyStock} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-section">新增貨號</h2>
        <SkuCreateForm action={createSku.bind(null, id)} locations={locationOptions} />
      </section>

      <section className="border-t border-line pt-6">
        <h2 className="mb-2 text-section">商品資料</h2>
        <ActionForm action={updateProduct.bind(null, id)}>
          <ProductFields initial={product} />
          <SubmitButton>儲存商品</SubmitButton>
        </ActionForm>
      </section>

      <section className="flex gap-3 border-t border-line pt-6">
        <ButtonLink href="/products">回商品列表</ButtonLink>
        <ActionForm action={deleteProduct.bind(null, id)} confirmText={`刪除商品「${product.name}」？`}>
          <SubmitButton variant="danger">刪除商品</SubmitButton>
        </ActionForm>
      </section>
    </div>
  );
}
