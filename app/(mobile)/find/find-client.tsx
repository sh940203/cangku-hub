"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { LocationTag } from "@/components/stock/location-tag";
import { StockNumber } from "@/components/stock/stock-number";
import { Input } from "@/components/ui/field";
import { SkeletonList } from "@/components/ui/skeleton";
import { searchSkus, snapshotAvailability } from "@/lib/find/search";
import type { Snapshot, SnapshotSku } from "@/lib/find/types";

type Load = { state: "loading" } | { state: "ready"; snapshot: Snapshot } | { state: "error" };

const timeFmt = new Intl.DateTimeFormat("zh-TW", {
  timeZone: "Asia/Taipei",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const skuLabel = (s: SnapshotSku) => [s.productName, s.variantName].filter(Boolean).join(" ");

// The URL (?q=&sku=) is the source of truth for the query and the selected SKU, so back/forward and reloads work.
const URL_EVENT = "find:url";

function subscribeUrl(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  window.addEventListener(URL_EVENT, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(URL_EVENT, onChange);
  };
}

function writeUrl(q: string, sku: number | null, push: boolean) {
  const p = new URLSearchParams();
  if (q) p.set("q", q);
  if (sku) p.set("sku", String(sku));
  const url = `/find${p.size ? `?${p}` : ""}`;
  if (push) history.pushState(null, "", url);
  else history.replaceState(null, "", url);
  window.dispatchEvent(new Event(URL_EVENT));
}

function useFindUrl() {
  const search = useSyncExternalStore(
    subscribeUrl,
    () => window.location.search,
    () => "",
  );
  return useMemo(() => {
    const p = new URLSearchParams(search);
    const sku = Number(p.get("sku"));
    return { query: p.get("q") ?? "", selectedId: Number.isInteger(sku) && sku > 0 ? sku : null };
  }, [search]);
}

export function FindClient() {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const { query, selectedId } = useFindUrl();

  useEffect(() => {
    let alive = true;
    const refresh = () => {
      // The service worker answers from cache when offline (NetworkFirst).
      fetch("/api/snapshot")
        .then((res) => (res.ok ? (res.json() as Promise<Snapshot>) : Promise.reject(new Error(String(res.status)))))
        .then((snapshot) => alive && setLoad({ state: "ready", snapshot }))
        .catch(() => alive && setLoad((prev) => (prev.state === "ready" ? prev : { state: "error" })));
    };
    const onVisible = () => document.visibilityState === "visible" && refresh();
    refresh();
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const snapshot = load.state === "ready" ? load.snapshot : null;
  const available = useMemo(() => (snapshot ? snapshotAvailability(snapshot) : new Map<number, number>()), [snapshot]);
  const byId = useMemo(() => new Map(snapshot?.skus.map((s) => [s.id, s]) ?? []), [snapshot]);
  const results = useMemo(() => (snapshot ? searchSkus(snapshot.skus, query) : []), [snapshot, query]);
  const selected = selectedId !== null ? byId.get(selectedId) : undefined;

  const select = (id: number) => {
    writeUrl(query, id, true);
    window.scrollTo(0, 0);
  };

  if (selected) {
    return (
      <SkuDetail
        sku={selected}
        available={available}
        byId={byId}
        onBack={() => history.back()}
        onSelect={select}
      />
    );
  }

  return (
    <>
      <form onSubmit={(e) => e.preventDefault()} className="mb-4">
        <Input
          type="search"
          value={query}
          onChange={(e) => writeUrl(e.target.value, null, false)}
          placeholder="搜尋商品名、貨號"
          aria-label="搜尋商品名、貨號"
          autoFocus
          enterKeyHint="search"
          className="w-full"
        />
      </form>

      {load.state === "loading" && <SkeletonList rows={3} />}
      {load.state === "error" && (
        <p className="text-ink-2">還沒有存過商品資料。連上網路後開一次找貨頁，之後離線也能查。</p>
      )}
      {snapshot &&
        (!query.trim() ? (
          <p className="text-ink-2">輸入商品名或貨號找貨。</p>
        ) : results.length === 0 ? (
          <p className="text-ink-2">找不到「{query.trim()}」。換個關鍵字，或用貨號找。</p>
        ) : (
          <ul className="-mx-4 divide-y divide-line border-y border-line bg-surface lg:mx-0">
            {results.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => select(s.id)}
                  className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left active:bg-bg"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block">{skuLabel(s)}</span>
                    <span className="font-code font-semibold text-aux text-ink-2">
                      {s.code}
                      {s.isBundle && <span className="ml-2 font-sans font-normal">組合</span>}
                    </span>
                  </span>
                  {s.locationCode && <LocationTag code={s.locationCode} />}
                  <span className="w-12 text-right">
                    <StockNumber value={available.get(s.id) ?? 0} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ))}

      {snapshot && <SnapshotTime at={snapshot.generatedAt} />}
    </>
  );
}

function SkuDetail({
  sku,
  available,
  byId,
  onBack,
  onSelect,
}: {
  sku: SnapshotSku;
  available: Map<number, number>;
  byId: Map<number, SnapshotSku>;
  onBack: () => void;
  onSelect: (id: number) => void;
}) {
  const parts = sku.components
    .map((c) => ({ ...c, sku: byId.get(c.skuId) }))
    .filter((p): p is typeof p & { sku: SnapshotSku } => p.sku !== undefined);
  // A bundle has no shelf of its own; if all its parts sit together, show that shelf big.
  const partLocations = [...new Set(parts.map((p) => p.sku.locationCode).filter(Boolean))] as string[];
  const bigTag = sku.isBundle ? (partLocations.length === 1 ? partLocations[0] : null) : sku.locationCode;

  return (
    <div className="space-y-5">
      <button type="button" onClick={onBack} className="min-h-12 text-action">
        ‹ 搜尋結果
      </button>
      <div>
        <h1 className="text-page">{skuLabel(sku)}</h1>
        <p className="font-code font-semibold text-ink-2">{sku.code}</p>
      </div>

      {bigTag ? (
        <LocationTag code={bigTag} size="lg" />
      ) : (
        <p className="text-ink-2">
          {sku.isBundle ? (partLocations.length ? "部件放在不同儲位，見下方。" : "部件還沒有指定儲位。") : "還沒有指定儲位。"}
        </p>
      )}

      <div className="flex items-baseline justify-between border-y border-line py-3">
        <span>{sku.isBundle ? `${sku.variantName ?? "組合"}可售` : "庫存"}</span>
        <StockNumber value={available.get(sku.id) ?? 0} safety={sku.isBundle ? null : sku.safetyStock} size="lg" />
      </div>

      {sku.isBundle && (
        <section>
          <h2 className="mb-2 text-section">部件</h2>
          {parts.length === 0 ? (
            <p className="text-ink-2">這個組合還沒有設定部件。</p>
          ) : (
            <ul className="-mx-4 divide-y divide-line border-y border-line bg-surface lg:mx-0">
              {parts.map((p) => (
                <li key={p.skuId}>
                  <button
                    type="button"
                    onClick={() => onSelect(p.skuId)}
                    className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left active:bg-bg"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block">
                        {p.sku.variantName ?? p.sku.productName}
                        {p.qty > 1 && <span className="ml-1 text-aux text-ink-2">× {p.qty}</span>}
                      </span>
                      <span className="font-code font-semibold text-aux text-ink-2">{p.sku.code}</span>
                    </span>
                    {p.sku.locationCode && partLocations.length > 1 && <LocationTag code={p.sku.locationCode} />}
                    <span className="w-24 text-right">
                      <StockNumber value={Math.max(0, p.sku.stock ?? 0)} safety={p.sku.safetyStock} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function SnapshotTime({ at }: { at: number }) {
  return <p className="mt-6 text-aux text-ink-2">資料時間 {timeFmt.format(at)}</p>;
}
