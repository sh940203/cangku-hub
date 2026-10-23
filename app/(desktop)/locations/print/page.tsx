import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { LocationTag } from "@/components/stock/location-tag";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { getDb } from "@/db";
import { locations } from "@/db/schema";
import { FLOORS, type Floor } from "@/lib/locations/code";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";

export default async function PrintLocationsPage({ searchParams }: PageProps<"/locations/print">) {
  const floorParam = (await searchParams).floor;
  const floor = FLOORS.includes(floorParam as Floor) ? (floorParam as Floor) : null;
  const db = getDb();
  const rows = await (floor
    ? db.select().from(locations).where(eq(locations.floor, floor)).orderBy(asc(locations.code))
    : db.select().from(locations).orderBy(asc(locations.code)));

  const filters: { label: string; href: string; active: boolean }[] = [
    { label: "全部", href: "/locations/print", active: floor === null },
    ...FLOORS.map((f) => ({ label: f, href: `/locations/print?floor=${f}`, active: floor === f })),
  ];

  return (
    <>
      <div className="print:hidden">
        <PageHeader title="列印儲位標籤" />
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <nav aria-label="篩選樓層" className="flex gap-1">
            {filters.map((f) => (
              <Link
                key={f.label}
                href={f.href}
                aria-current={f.active ? "page" : undefined}
                className={`rounded-control px-3 py-2 ${f.active ? "bg-surface font-medium text-action" : "text-ink-2"}`}
              >
                {f.label}
              </Link>
            ))}
          </nav>
          <PrintButton disabled={rows.length === 0} />
          <ButtonLink href="/locations" variant="text">
            回儲位列表
          </ButtonLink>
        </div>
        <p className="mb-4 text-aux text-ink-2">A4 直式，一頁 14 張（2 欄 × 7 列）。列印時請選「實際大小」並開啟背景圖形。</p>
      </div>

      {rows.length === 0 ? (
        <p className="text-ink-2">沒有可以列印的儲位。先到儲位頁新增。</p>
      ) : (
        <div className="label-sheet">
          {rows.map((r) => (
            <div key={r.id} className="label-cell">
              <LocationTag code={r.code} size="print" />
              {r.description && <p className="label-note">{r.description}</p>}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
