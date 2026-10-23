import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LocationTag } from "@/components/stock/location-tag";
import { StockNumber } from "@/components/stock/stock-number";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Field, Input } from "@/components/ui/field";
import { getDb } from "@/db";
import { locations, products, skus } from "@/db/schema";
import { submitCount } from "../actions";

export const dynamic = "force-dynamic";

export default async function StocktakeSkuPage({ params }: PageProps<"/stocktake/[skuId]">) {
  const skuId = Number((await params).skuId);
  const [row] = Number.isInteger(skuId)
    ? await getDb()
        .select({
          id: skus.id,
          code: skus.code,
          variantName: skus.variantName,
          isBundle: skus.isBundle,
          stock: skus.stock,
          safetyStock: skus.safetyStock,
          productName: products.name,
          locationCode: locations.code,
        })
        .from(skus)
        .innerJoin(products, eq(products.id, skus.productId))
        .leftJoin(locations, eq(locations.id, skus.locationId))
        .where(eq(skus.id, skuId))
    : [];
  if (!row) notFound();

  return (
    <div className="max-w-md space-y-5">
      <Link href="/stocktake" className="text-aux text-action hover:underline">
        ‹ 盤點
      </Link>
      <div>
        <h1 className="text-page">
          {row.productName} {row.variantName}
        </h1>
        <p className="font-code font-semibold text-ink-2">{row.code}</p>
      </div>
      {row.locationCode && <LocationTag code={row.locationCode} size="lg" />}

      {row.isBundle ? (
        <p className="text-ink-2">這是組合商品，沒有自己的庫存。請盤它的部件。</p>
      ) : (
        <>
          <div className="flex items-baseline justify-between border-y border-line py-3">
            <span className="text-ink-2">系統庫存</span>
            <StockNumber value={row.stock ?? 0} safety={row.safetyStock} size="lg" />
          </div>
          <ActionForm action={submitCount.bind(null, row.id)} className="space-y-4">
            <Field label="實際數量">
              <Input
                name="counted"
                inputMode="numeric"
                pattern="[0-9]*"
                required
                autoFocus
                className="font-code text-number font-semibold"
              />
            </Field>
            <Field label="備註（可空白）">
              <Input name="note" placeholder="例：發現一條破損" />
            </Field>
            <SubmitButton variant="primary" className="w-full">
              寫入盤點數量
            </SubmitButton>
          </ActionForm>
        </>
      )}
    </div>
  );
}
