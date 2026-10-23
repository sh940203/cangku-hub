"use server";

import { refresh } from "next/cache";
import { getDb } from "@/db";
import { type FormState, int, optStr } from "@/lib/form";
import { adjustStock, StockError } from "@/lib/stock/movements";

export async function submitCount(skuId: number, _: FormState, fd: FormData): Promise<FormState> {
  const counted = int(fd, "counted");
  if (counted === null || Number.isNaN(counted) || counted < 0) return { error: "實際數量請填 0 以上的整數。" };
  try {
    const { delta, stock } = await adjustStock(getDb(), skuId, counted, optStr(fd, "note"));
    refresh();
    if (delta === 0) return { ok: `數量相同（${stock}），不用調整。` };
    return { ok: `已調整為 ${stock}（${delta > 0 ? `+${delta}` : delta}）。` };
  } catch (e) {
    if (e instanceof StockError) return { error: e.message };
    throw e;
  }
}
