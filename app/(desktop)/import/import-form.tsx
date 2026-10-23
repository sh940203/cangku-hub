"use client";

import { useState, useTransition } from "react";
import { read, utils } from "xlsx";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/field";
import { assertNoPii, PiiError, stripPiiColumns } from "@/lib/pii";
import { getAdapter } from "@/lib/platforms";
import type { ParsedOrderLine, SkippedRow } from "@/lib/platforms/types";
import { type ImportResult, importOrdersAction } from "./actions";

type PlatformOption = { id: string; label: string; ready: boolean };

type Preview = {
  filename: string;
  lines: ParsedOrderLine[];
  orders: number;
  cancelled: number;
  skipped: SkippedRow[];
  droppedColumns: string[];
};

// Parsing and PII removal happen here in the browser; only Preview.lines is sent to the server.
async function parseFile(file: File, platform: string): Promise<{ preview: Preview } | { error: string }> {
  const adapter = getAdapter(platform);
  if (!adapter) return { error: "請選擇平台。" };
  let rows: Record<string, unknown>[];
  try {
    const wb = read(await file.arrayBuffer(), { dense: true });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    rows = utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: true });
  } catch {
    return { error: "讀不到這個檔案。請選擇平台匯出的 Excel（.xlsx / .xls）或 CSV。" };
  }
  const { rows: clean, dropped } = stripPiiColumns(rows);
  const parsed = adapter.parseOrders(clean);
  if (!parsed.ok) return { error: parsed.error };
  try {
    assertNoPii(parsed.lines);
  } catch (e) {
    if (e instanceof PiiError) return { error: e.message };
    throw e;
  }
  const orderNos = new Set(parsed.lines.map((l) => l.orderNo));
  const cancelledNos = new Set(parsed.lines.filter((l) => l.cancelled).map((l) => l.orderNo));
  return {
    preview: {
      filename: file.name,
      lines: parsed.lines,
      orders: orderNos.size,
      cancelled: cancelledNos.size,
      skipped: parsed.skipped,
      droppedColumns: dropped,
    },
  };
}

export function ImportForm({ platforms }: { platforms: PlatformOption[] }) {
  const [platform, setPlatform] = useState(platforms.find((p) => p.ready)?.id ?? platforms[0]?.id ?? "");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, startTransition] = useTransition();
  const selected = platforms.find((p) => p.id === platform);

  const onFile = async (file: File | undefined) => {
    setPreview(null);
    setResult(null);
    setError(null);
    if (!file) return;
    const res = await parseFile(file, platform);
    if ("error" in res) setError(res.error);
    else setPreview(res.preview);
  };

  const submit = () => {
    if (!preview) return;
    startTransition(async () => {
      const res = await importOrdersAction(platform, preview.filename, preview.lines);
      setResult(res);
      if (res.ok) setPreview(null);
    });
  };

  return (
    <div className="max-w-3xl space-y-5">
      <ol className="space-y-5">
        <li className="space-y-2">
          <h2 className="text-section">1. 選平台</h2>
          <div className="max-w-xs">
            <Field label="平台">
              <Select
                value={platform}
                onChange={(e) => {
                  setPlatform(e.target.value);
                  setPreview(null);
                  setError(null);
                }}
              >
                {platforms.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                    {p.ready ? "" : "（欄位未設定）"}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          {selected && !selected.ready && (
            <p className="rounded-control bg-warn-bg px-3 py-2 text-warn">
              {selected.label}訂單的欄位名稱還沒確認，暫時不能匯入。請提供一份{selected.label}訂單匯出檔。
            </p>
          )}
        </li>

        <li className="space-y-2">
          <h2 className="text-section">2. 選擇訂單檔</h2>
          <p className="text-aux text-ink-2">檔案只在這台電腦的瀏覽器裡讀取。姓名、電話、地址等欄位會先刪掉，不會送出。</p>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            disabled={!selected?.ready}
            onChange={(e) => {
              const file = e.target.files?.[0];
              // Clear so picking the same file again (e.g. a re-import) still fires change.
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
        </li>

        {preview && (
          <li className="space-y-3">
            <h2 className="text-section">3. 確認內容</h2>
            <p className="text-ink-2">{preview.filename}</p>
            <dl className="grid grid-cols-3 divide-x divide-line border-y border-line bg-surface text-center">
              <Stat label="訂單" value={preview.orders} />
              <Stat label="品項列" value={preview.lines.length} />
              <Stat label="其中已取消" value={preview.cancelled} />
            </dl>
            {preview.droppedColumns.length > 0 && (
              <p className="text-aux text-ink-2">已在瀏覽器刪除 {preview.droppedColumns.length} 個個資欄位：{preview.droppedColumns.join("、")}</p>
            )}
            {preview.skipped.length > 0 && (
              <details className="text-aux text-warn">
                <summary>有 {preview.skipped.length} 列跳過，不會匯入</summary>
                <ul className="mt-1 list-disc pl-5">
                  {preview.skipped.slice(0, 50).map((s) => (
                    <li key={s.row}>
                      第 {s.row} 列：{s.reason}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <Button variant="primary" onClick={submit} disabled={pending}>
              {pending ? "匯入中…" : "匯入訂單"}
            </Button>
          </li>
        )}
      </ol>

      {result && !result.ok && (
        <p role="alert" className="rounded-control bg-error-bg px-3 py-2 text-error">
          {result.error}
        </p>
      )}
      {result?.ok && <ResultSummary summary={result.summary} />}
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

function ResultSummary({ summary: s }: { summary: Extract<ImportResult, { ok: true }>["summary"] }) {
  return (
    <section role="status" className="space-y-2 rounded-control bg-ok-bg px-4 py-3 text-ok">
      <p className="font-medium">已匯入 {s.orders} 筆訂單。</p>
      <p>
        新訂單 {s.newOrders}　扣庫存 {s.deducted} 項　取消加回 {s.cancelled} 筆　未對應 {s.unmatched} 項
      </p>
      {s.orders > 0 && s.newOrders === 0 && s.deducted === 0 && s.cancelled === 0 && (
        <p>這份檔案之前已經匯入過，庫存沒有重複扣。</p>
      )}
      {s.unmatched > 0 && <p className="text-warn">有 {s.unmatched} 項貨號對不到商品，請在下方手動對應。</p>}
      {s.emptyBundles.length > 0 && (
        <p className="text-warn">組合 {s.emptyBundles.join("、")} 還沒設定部件，這些品項沒有扣庫存。請先到商品頁加入部件，再重新匯入同一份檔案。</p>
      )}
    </section>
  );
}
