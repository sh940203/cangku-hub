"use server";

import { refresh } from "next/cache";
import { getDb } from "@/db";
import { type FormState, int } from "@/lib/form";
import { type ImportSummary, importOrders, MappingError, mapOrderItem } from "@/lib/orders/import";
import { PiiError } from "@/lib/pii";
import { getAdapter } from "@/lib/platforms";
import type { ParsedOrderLine } from "@/lib/platforms/types";

export type ImportResult = { ok: true; summary: ImportSummary } | { ok: false; error: string };

function isLine(v: unknown): v is ParsedOrderLine {
  const l = v as ParsedOrderLine;
  return (
    typeof l === "object" &&
    l !== null &&
    typeof l.orderNo === "string" &&
    typeof l.status === "string" &&
    typeof l.cancelled === "boolean" &&
    (l.orderedAt === null || typeof l.orderedAt === "number") &&
    typeof l.skuCode === "string" &&
    typeof l.name === "string" &&
    Number.isInteger(l.qty) &&
    l.qty > 0
  );
}

export async function importOrdersAction(platform: string, filename: string, lines: unknown): Promise<ImportResult> {
  const adapter = getAdapter(platform);
  if (!adapter?.ready) return { ok: false, error: "這個平台還不能匯入。" };
  if (!Array.isArray(lines) || lines.length === 0 || !lines.every(isLine)) {
    return { ok: false, error: "訂單資料格式不對，請重新選擇檔案。" };
  }
  try {
    const summary = await importOrders(getDb(), { platform: adapter.id, filename: filename.slice(0, 200), lines });
    refresh();
    return { ok: true, summary };
  } catch (e) {
    if (e instanceof PiiError) return { ok: false, error: e.message };
    throw e;
  }
}

export async function mapItemAction(orderItemId: number, platform: string, _: FormState, fd: FormData): Promise<FormState> {
  const skuId = int(fd, "skuId");
  if (skuId === null || Number.isNaN(skuId)) return { error: "請選擇要對應的貨號。" };
  const adapter = getAdapter(platform);
  try {
    const { deducted } = await mapOrderItem(getDb(), orderItemId, skuId, adapter?.cancelledStatuses ?? []);
    refresh();
    return { ok: deducted ? "已對應並扣庫存。" : "已對應（訂單已取消，不扣庫存）。" };
  } catch (e) {
    if (e instanceof MappingError) return { error: e.message };
    throw e;
  }
}
