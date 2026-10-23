import { asc, count, eq } from "drizzle-orm";
import Link from "next/link";
import { LocationTag } from "@/components/stock/location-tag";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { getDb } from "@/db";
import { locations, skus } from "@/db/schema";
import { createLocation } from "./actions";
import { LocationForm } from "./location-form";

export const dynamic = "force-dynamic";

export default async function LocationsPage() {
  const rows = await getDb()
    .select({
      id: locations.id,
      code: locations.code,
      description: locations.description,
      skuCount: count(skus.id),
    })
    .from(locations)
    .leftJoin(skus, eq(skus.locationId, locations.id))
    .groupBy(locations.id)
    .orderBy(asc(locations.code));

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <PageHeader title="儲位" />
        <ButtonLink href="/locations/print">列印儲位標籤</ButtonLink>
      </div>

      <section className="mb-6 max-w-4xl">
        <h2 className="mb-2 text-section">新增儲位</h2>
        <LocationForm action={createLocation} submitLabel="新增儲位" />
      </section>

      {rows.length === 0 ? (
        <p className="text-ink-2">還沒有儲位。從上面新增第一個，例如 4F-T-01。</p>
      ) : (
        <table className="w-full max-w-4xl border-y border-line bg-surface">
          <thead className="text-left text-aux text-ink-2">
            <tr className="border-b border-line">
              <th className="px-3 py-2 font-normal">儲位</th>
              <th className="px-3 py-2 font-normal">說明</th>
              <th className="px-3 py-2 text-right font-normal">貨號數</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.id} className="h-14">
                <td className="px-3">
                  <LocationTag code={r.code} />
                </td>
                <td className="px-3 text-ink-2">{r.description}</td>
                <td className="px-3 text-right">{r.skuCount}</td>
                <td className="px-3 text-right">
                  <Link href={`/locations/${r.id}`} className="text-action hover:underline">
                    編輯
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
