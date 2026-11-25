"use client";

import { useState, useTransition } from "react";
import { read, utils, type WorkBook, writeFile } from "xlsx";
import { Button } from "@/components/ui/button";
import { getAdapter } from "@/lib/platforms";
import type { ListingLine, SkippedRow } from "@/lib/platforms/types";
import type { ListingImportSummary } from "@/lib/catalog/import-listings";
import { importListingsAction, listingCodesAction } from "./actions";

type PlatformOption = { id: string; label: string; howToGet: string };
type Loaded = {
  filename: string;
  wb: WorkBook;
  rows: unknown[][];
  lines: ListingLine[];
  skipped: SkippedRow[];
  products: number;
  withStock: number;
};

const PRODUCTS_PER_CALL = 150; // keep each request small; whole products per call

function sheetRows(wb: WorkBook) {
  return utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "", raw: false });
}

function byProduct(lines: readonly ListingLine[]) {
  const groups = new Map<string, ListingLine[]>();
  for (const l of lines) groups.set(l.itemId, [...(groups.get(l.itemId) ?? []), l]);
  const parts: ListingLine[][] = [];
  const all = [...groups.values()];
  for (let i = 0; i < all.length; i += PRODUCTS_PER_CALL) parts.push(all.slice(i, i + PRODUCTS_PER_CALL).flat());
  return parts;
}

export function ListingImportForm({ platforms }: { platforms: PlatformOption[] }) {
  const platform = platforms[0];
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [summary, setSummary] = useState<ListingImportSummary | null>(null);
  const [written, setWritten] = useState<{ filled: number; missing: number } | null>(null);
  const [pending, startTransition] = useTransition();

  if (!platform) return <p className="text-ink-2">目前沒有可以匯入商品的平台。</p>;
  const template = getAdapter(platform.id)?.listings;

  const onFile = async (file: File | undefined) => {
    setLoaded(null);
    setError(null);
    setSummary(null);
    setWritten(null);
    if (!file || !template) return;
    let wb: WorkBook;
    try {
      wb = read(await file.arrayBuffer());
    } catch {
      return setError("讀不到這個檔案，請選擇從平台下載的 .xlsx。");
    }
    const rows = sheetRows(wb);
    const parsed = template.parse(rows);
    if (!parsed.ok) return setError(parsed.error);
    setLoaded({
      filename: file.name,
      wb,
      rows,
      lines: parsed.lines,
      skipped: parsed.skipped,
      products: new Set(parsed.lines.map((l) => l.itemId)).size,
      withStock: parsed.lines.filter((l) => l.stock > 0).length,
    });
  };

  const runImport = () => {
    if (!loaded) return;
    startTransition(async () => {
      setError(null);
      const total: ListingImportSummary = { newProducts: 0, newSkus: 0, linked: 0, existing: 0, stockAdded: 0 };
      const parts = byProduct(loaded.lines);
      for (const [i, part] of parts.entries()) {
        setProgress(`匯入中… ${i + 1} / ${parts.length}`);
        const res = await importListingsAction(platform.id, part);
        if (!res.ok) {
          setProgress(null);
          return setError(`${res.error}（已完成的部分不會重複匯入，可以直接再按一次）`);
        }
        for (const k of Object.keys(total) as (keyof ListingImportSummary)[]) total[k] += res.summary[k];
      }
      setProgress(null);
      setSummary(total);
    });
  };

  const download = () => {
    if (!loaded || !template) return;
    startTransition(async () => {
      const codes = await listingCodesAction(platform.id, loaded.lines.map((l) => l.variantId));
      const edits = template.edits(loaded.rows, new Map(Object.entries(codes)));
      const ws = loaded.wb.Sheets[loaded.wb.SheetNames[0]];
      for (const e of edits) {
        ws[utils.encode_cell({ r: e.row, c: e.col })] =
          typeof e.value === "number" ? { t: "n", v: e.value } : { t: "s", v: e.value };
      }
      const filled = Object.keys(codes).length;
      setWritten({ filled, missing: loaded.lines.length - filled });
      writeFile(loaded.wb, loaded.filename.replace(/\.xlsx?$/i, "") + "_貨號.xlsx");
    });
  };

  return (
    <div className="max-w-3xl space-y-6">
      <section className="space-y-2">
        <h2 className="text-section">1. 下載{platform.label}商品檔</h2>
        <p className="text-ink-2">{platform.howToGet}</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-section">2. 選擇檔案</h2>
        <p className="text-aux text-ink-2">檔案在瀏覽器裡讀取，只送出商品名稱、規格、庫存與平台編號。</p>
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            void onFile(file);
          }}
          className="block min-h-12 file:mr-3 file:min-h-10 file:rounded-control file:border file:border-line file:bg-surface file:px-4 file:text-ink"
        />
        {error && (
          <p role="alert" className="rounded-control bg-error-bg px-3 py-2 text-error">
            {error}
          </p>
        )}
      </section>

      {loaded && (
        <section className="space-y-3">
          <h2 className="text-section">3. 匯入</h2>
          <p className="text-ink-2">{loaded.filename}</p>
          <dl className="grid grid-cols-3 divide-x divide-line border-y border-line bg-surface text-center">
            <Stat label="商品" value={loaded.products} />
            <Stat label="規格" value={loaded.lines.length} />
            <Stat label="有庫存" value={loaded.withStock} />
          </dl>
          {loaded.skipped.length > 0 && (
            <details className="text-aux text-warn">
              <summary>有 {loaded.skipped.length} 列跳過，不會匯入</summary>
              <ul className="mt-1 list-disc pl-5">
                {loaded.skipped.slice(0, 50).map((s) => (
                  <li key={s.row}>
                    第 {s.row} 列：{s.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <p className="text-aux text-ink-2">
            每個規格會建一個貨號（單一規格 P0001，多規格 P0002-01、P0002-02…），{platform.label}上的庫存當作初始庫存。
            已經在系統裡的規格不會重複建立，庫存也不會被改掉。
          </p>
          {!summary && (
            <Button variant="primary" onClick={runImport} disabled={pending}>
              {progress ?? "匯入商品"}
            </Button>
          )}
        </section>
      )}

      {summary && (
        <section role="status" className="space-y-1 rounded-control bg-ok-bg px-4 py-3 text-ok">
          <p className="font-medium">
            匯入完成：新商品 {summary.newProducts}、新貨號 {summary.newSkus}
            {summary.linked > 0 && `、對上原有貨號 ${summary.linked}`}
          </p>
          <p>
            初始庫存共 {summary.stockAdded} 件。{summary.existing > 0 && `${summary.existing} 個規格之前已匯入，沒有變動。`}
          </p>
        </section>
      )}

      {summary && loaded && (
        <section className="space-y-2">
          <h2 className="text-section">4. 把貨號寫回{platform.label}</h2>
          <p className="text-ink-2">
            下載的檔案就是你剛才選的那份，只多填了「主商品貨號」和「商品選項貨號」，價格、庫存都沒動。到同一頁按「上傳」，
            之後{platform.label}訂單就會帶著這些貨號，匯入訂單時能自動對上。
          </p>
          <Button variant="primary" onClick={download} disabled={pending}>
            下載填好貨號的檔案
          </Button>
          {written && (
            <p className="text-aux text-ink-2">
              已填 {written.filled} 個規格{written.missing > 0 && `，${written.missing} 個不在系統裡沒填`}。
            </p>
          )}
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="py-3">
      <dt className="text-aux text-ink-2">{label}</dt>
      <dd className="font-code text-number font-semibold">{value}</dd>
    </div>
  );
}
