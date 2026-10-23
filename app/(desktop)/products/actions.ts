"use server";

import { and, count, eq, or } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { bundleComponents, orderItems, platformListings, products, skus, stockMovements } from "@/db/schema";
import { type FormState, int, isUniqueViolation, num, optStr, str } from "@/lib/form";
import { recordMovement } from "@/lib/stock/movements";

// ---------- products ----------

function readProduct(fd: FormData) {
  const name = str(fd, "name");
  if (!name) return { error: "請填商品名稱。" } as const;
  const weightG = int(fd, "weightG");
  const dims = { lengthCm: num(fd, "lengthCm"), widthCm: num(fd, "widthCm"), heightCm: num(fd, "heightCm") };
  if (Number.isNaN(weightG) || (weightG !== null && weightG < 0)) return { error: "重量請填 0 以上的整數（公克）。" } as const;
  if (Object.values(dims).some((v) => Number.isNaN(v) || (v !== null && v < 0))) {
    return { error: "尺寸請填 0 以上的數字（公分）。" } as const;
  }
  return { value: { name, category: optStr(fd, "category"), notes: optStr(fd, "notes"), weightG, ...dims } } as const;
}

export async function createProduct(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = readProduct(fd);
  if ("error" in parsed) return { error: parsed.error };
  const [p] = await getDb().insert(products).values(parsed.value).returning({ id: products.id });
  redirect(`/products/${p.id}`);
}

export async function updateProduct(id: number, _: FormState, fd: FormData): Promise<FormState> {
  const parsed = readProduct(fd);
  if ("error" in parsed) return { error: parsed.error };
  await getDb().update(products).set(parsed.value).where(eq(products.id, id));
  refresh();
  return { ok: "已儲存商品。" };
}

export async function deleteProduct(id: number): Promise<FormState> {
  const db = getDb();
  const [{ n }] = await db.select({ n: count() }).from(skus).where(eq(skus.productId, id));
  if (n > 0) return { error: `這個商品還有 ${n} 個貨號，先刪除或封存貨號。` };
  await db.delete(products).where(eq(products.id, id));
  redirect("/products");
}

// ---------- SKUs ----------

function readSkuCommon(fd: FormData) {
  const code = str(fd, "code");
  if (!code) return { error: "請填貨號。" } as const;
  if (/\s/.test(code)) return { error: "貨號不能有空白。" } as const;
  return { code, variantName: optStr(fd, "variantName"), barcode: optStr(fd, "barcode") || code } as const;
}

function readPhysicalFields(fd: FormData) {
  const locationId = int(fd, "locationId");
  const safetyStock = int(fd, "safetyStock");
  if (Number.isNaN(safetyStock) || (safetyStock !== null && safetyStock < 0)) {
    return { error: "安全庫存請填 0 以上的整數。" } as const;
  }
  return { locationId: Number.isNaN(locationId) ? null : locationId, safetyStock } as const;
}

export async function createSku(productId: number, _: FormState, fd: FormData): Promise<FormState> {
  const common = readSkuCommon(fd);
  if ("error" in common) return { error: common.error };
  const isBundle = str(fd, "kind") === "bundle";
  const physical = isBundle ? { locationId: null, safetyStock: null } : readPhysicalFields(fd);
  if ("error" in physical) return { error: physical.error };
  const initial = isBundle ? null : int(fd, "initialStock");
  if (Number.isNaN(initial) || (initial !== null && initial < 0)) return { error: "初始庫存請填 0 以上的整數。" };

  const db = getDb();
  let skuId: number;
  try {
    skuId = await db.transaction(async (tx) => {
      const [sku] = await tx
        .insert(skus)
        .values({ ...common, ...physical, productId, isBundle, stock: isBundle ? null : 0 })
        .returning({ id: skus.id });
      if (initial) {
        await recordMovement(tx, { skuId: sku.id, delta: initial, reason: "initial", refType: "manual" });
      }
      return sku.id;
    });
  } catch (e) {
    if (isUniqueViolation(e)) return { error: `貨號 ${common.code} 已經有人用了。` };
    throw e;
  }
  // Bundles need components next, so go straight to the SKU page.
  if (isBundle) redirect(`/products/${productId}/skus/${skuId}`);
  refresh();
  return { ok: `已新增貨號 ${common.code}${initial ? `，初始庫存 ${initial}` : ""}。` };
}

export async function updateSku(skuId: number, _: FormState, fd: FormData): Promise<FormState> {
  const common = readSkuCommon(fd);
  if ("error" in common) return { error: common.error };
  const db = getDb();
  const [sku] = await db.select({ isBundle: skus.isBundle }).from(skus).where(eq(skus.id, skuId));
  if (!sku) return { error: "找不到這個貨號。" };
  const physical = sku.isBundle ? { locationId: null, safetyStock: null } : readPhysicalFields(fd);
  if ("error" in physical) return { error: physical.error };
  const status = str(fd, "status") === "archived" ? "archived" : "active";
  try {
    await db.update(skus).set({ ...common, ...physical, status }).where(eq(skus.id, skuId));
  } catch (e) {
    if (isUniqueViolation(e)) return { error: `貨號 ${common.code} 已經有人用了。` };
    throw e;
  }
  refresh();
  return { ok: "已儲存貨號。" };
}

export async function deleteSku(productId: number, skuId: number): Promise<FormState> {
  const db = getDb();
  const uses = await Promise.all([
    db.select({ n: count() }).from(stockMovements).where(eq(stockMovements.skuId, skuId)),
    db.select({ n: count() }).from(orderItems).where(eq(orderItems.skuId, skuId)),
    db.select({ n: count() }).from(platformListings).where(eq(platformListings.skuId, skuId)),
    db.select({ n: count() }).from(bundleComponents).where(eq(bundleComponents.componentSkuId, skuId)),
  ]);
  const [movements, orderLines, listings, asComponent] = uses.map(([r]) => r.n);
  if (asComponent > 0) return { error: `這個貨號是 ${asComponent} 個組合的部件，先從組合移除。` };
  if (movements + orderLines + listings > 0) {
    return { error: "這個貨號已經有庫存異動或訂單紀錄，不能刪除。不再使用的話請改成「封存」。" };
  }
  await db.transaction(async (tx) => {
    await tx.delete(bundleComponents).where(eq(bundleComponents.bundleSkuId, skuId));
    await tx.delete(skus).where(eq(skus.id, skuId));
  });
  redirect(`/products/${productId}`);
}

// ---------- bundle components ----------

function readQty(fd: FormData) {
  const qty = int(fd, "qty");
  return qty !== null && Number.isInteger(qty) && qty >= 1 && qty <= 99 ? qty : null;
}

export async function addComponent(bundleSkuId: number, _: FormState, fd: FormData): Promise<FormState> {
  const componentSkuId = int(fd, "componentSkuId");
  const qty = readQty(fd);
  if (componentSkuId === null || Number.isNaN(componentSkuId)) return { error: "請選擇部件。" };
  if (qty === null) return { error: "數量請填 1 到 99。" };
  if (componentSkuId === bundleSkuId) return { error: "組合不能包含自己。" };

  const db = getDb();
  const rows = await db
    .select({ id: skus.id, isBundle: skus.isBundle, code: skus.code })
    .from(skus)
    .where(or(eq(skus.id, bundleSkuId), eq(skus.id, componentSkuId)));
  const bundle = rows.find((r) => r.id === bundleSkuId);
  const part = rows.find((r) => r.id === componentSkuId);
  if (!bundle?.isBundle) return { error: "這個貨號不是組合商品。" };
  if (!part) return { error: "找不到這個部件。" };
  if (part.isBundle) return { error: "部件必須是實體貨號，不能是另一個組合。" };

  try {
    await db.insert(bundleComponents).values({ bundleSkuId, componentSkuId, qty });
  } catch (e) {
    if (isUniqueViolation(e)) return { error: `${part.code} 已經是部件了，要改數量請直接修改。` };
    throw e;
  }
  refresh();
  return { ok: `已加入部件 ${part.code} × ${qty}。` };
}

export async function updateComponentQty(
  bundleSkuId: number,
  componentSkuId: number,
  _: FormState,
  fd: FormData,
): Promise<FormState> {
  const qty = readQty(fd);
  if (qty === null) return { error: "數量請填 1 到 99。" };
  await getDb()
    .update(bundleComponents)
    .set({ qty })
    .where(and(eq(bundleComponents.bundleSkuId, bundleSkuId), eq(bundleComponents.componentSkuId, componentSkuId)));
  refresh();
  return null;
}

export async function removeComponent(bundleSkuId: number, componentSkuId: number): Promise<FormState> {
  await getDb()
    .delete(bundleComponents)
    .where(and(eq(bundleComponents.bundleSkuId, bundleSkuId), eq(bundleComponents.componentSkuId, componentSkuId)));
  refresh();
  return null;
}
