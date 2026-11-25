"use client";

import { useState, useTransition } from "react";
import { read, utils, type WorkBook, writeFile } from "xlsx";
import { Button } from "@/components/ui/button";
import { getAdapter } from "@/lib/platforms";
import { markPushedAction, pushValuesAction } from "./actions";

type Built = { filename: string; entries: { variantId: string; stock: number }[]; changed: number; unknown: number };

export function PushForm({ platform }: { platform: { id: string; label: string; howToGet: string } }) {
  const [error, setError] = useState<string | null>(null);
  const [built, setBuilt] = useState<Built | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();
  const template = getAdapter(platform.id)?.listings;

  const onFile = (file: File | undefined) => {
    setError(null);
    setBuilt(null);
    setDone(false);
    if (!file || !template) return;
    startTransition(async () => {
      let wb: WorkBook;
      try {
        wb = read(await file.arrayBuffer());
      } catch {
        return setError("讀不到這個檔案，請選擇從平台下載的 .xlsx。");
      }
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "", raw: false });
      const parsed = template.parse(rows);
      if (!parsed.ok) return setError(parsed.error);
      const values = await pushValuesAction(platform.id, parsed.lines.map((l) => l.variantId));
      const map = new Map(Object.entries(values));
      if (map.size === 0) return setError(`檔案裡的規格都不在系統裡。請先到「商品 → 從平台匯入」匯入這份檔案。`);
      for (const e of template.edits(rows, map)) {
        ws[utils.encode_cell({ r: e.row, c: e.col })] =
          typeof e.value === "number" ? { t: "n", v: e.value } : { t: "s", v: e.value };
      }
      const entries = [...map].flatMap(([variantId, v]) => (v.stock === undefined ? [] : [{ variantId, stock: v.stock }]));
      const changed = parsed.lines.filter((l) => {
        const v = map.get(l.variantId);
        return v?.stock !== undefined && v.stock !== l.stock;
      }).length;
      const filename = file.name.replace(/\.xlsx?$/i, "") + "_庫存.xlsx";
      writeFile(wb, filename);
      setBuilt({
        filename,
        entries,
        changed,
        unknown: parsed.lines.length - map.size,
      });
    });
  };

  const confirm = () => {
    if (!built) return;
    startTransition(async () => {
      const res = await markPushedAction(platform.id, built.entries);
      if (!res.ok) return setError(res.error ?? "記錄失敗，請再按一次。");
      setDone(true);
    });
  };

  return (
    <section className="max-w-3xl space-y-5 border-t border-line pt-6">
      <div className="space-y-1">
        <h2 className="text-section">1. 下載{platform.label}最新的商品檔</h2>
        <p className="text-ink-2">{platform.howToGet}</p>
        <p className="text-aux text-ink-2">每次都要下載最新的，這樣價格等其他欄位才是{platform.label}上現在的樣子，上傳時不會被改回舊的。</p>
      </div>

      <div className="space-y-2">
        <h2 className="text-section">2. 選擇檔案，下載填好庫存的檔案</h2>
        <p className="text-aux text-ink-2">
          系統只改待更新規格的「庫存」，並補上貨號；其他規格的庫存和所有其他欄位都保留{platform.label}上現在的樣子，
          所以{platform.label}上已賣掉的數量不會被加回去。
        </p>
        <input
          type="file"
          accept=".xlsx,.xls"
          disabled={pending}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            onFile(file);
          }}
          className="block min-h-12 file:mr-3 file:min-h-10 file:rounded-control file:border file:border-line file:bg-surface file:px-4 file:text-ink"
        />
        {error && (
          <p role="alert" className="rounded-control bg-error-bg px-3 py-2 text-error">
            {error}
          </p>
        )}
        {built && (
          <p role="status" className="rounded-control bg-ok-bg px-3 py-2 text-ok">
            已下載 {built.filename}：{built.entries.length} 個待更新規格填入系統可售量，其中 {built.changed} 個和
            {platform.label}現在不同。其他規格保留{platform.label}上的庫存。
            {built.unknown > 0 && ` ${built.unknown} 個規格不在系統裡，維持原樣。`}
          </p>
        )}
      </div>

      {built && built.entries.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-section">3. 上傳到{platform.label}後，按「已上傳」</h2>
          <p className="text-aux text-ink-2">
            到{platform.label}同一頁按「上傳」，確認「紀錄」裡沒有失敗原因，再按下面的按鈕。沒按之前，待更新清單不會清掉。
          </p>
          {done ? (
            <p role="status" className="rounded-control bg-ok-bg px-3 py-2 text-ok">
              已記錄。這 {built.entries.length} 個規格的「上次上傳」已更新。
            </p>
          ) : (
            <Button variant="primary" onClick={confirm} disabled={pending}>
              已上傳到{platform.label}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
