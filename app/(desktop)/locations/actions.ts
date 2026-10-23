"use server";

import { count, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { listingDrafts, locations, skus } from "@/db/schema";
import { type FormState, int, isUniqueViolation, optStr, str } from "@/lib/form";
import { FLOORS, type Floor, formatLocationCode } from "@/lib/locations/code";

function readLocation(fd: FormData) {
  const floor = str(fd, "floor") as Floor;
  const zone = str(fd, "zone").toUpperCase();
  const number = int(fd, "number");
  if (!FLOORS.includes(floor)) return { error: "請選擇樓層。" } as const;
  if (!/^[A-Z]{1,2}$/.test(zone)) return { error: "區域請填 1 到 2 個英文字母，例如 T。" } as const;
  if (number === null || !Number.isInteger(number) || number < 1 || number > 99) {
    return { error: "編號請填 1 到 99。" } as const;
  }
  return {
    value: { code: formatLocationCode(floor, zone, number), floor, zone, description: optStr(fd, "description") },
  } as const;
}

export async function createLocation(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = readLocation(fd);
  if ("error" in parsed) return { error: parsed.error };
  try {
    await getDb().insert(locations).values(parsed.value);
  } catch (e) {
    if (isUniqueViolation(e)) return { error: `儲位 ${parsed.value.code} 已經存在。` };
    throw e;
  }
  refresh();
  return { ok: `已新增儲位 ${parsed.value.code}。` };
}

export async function updateLocation(id: number, _: FormState, fd: FormData): Promise<FormState> {
  const parsed = readLocation(fd);
  if ("error" in parsed) return { error: parsed.error };
  try {
    await getDb().update(locations).set(parsed.value).where(eq(locations.id, id));
  } catch (e) {
    if (isUniqueViolation(e)) return { error: `儲位 ${parsed.value.code} 已經存在。` };
    throw e;
  }
  redirect("/locations");
}

export async function deleteLocation(id: number): Promise<FormState> {
  const db = getDb();
  const [{ n: skuCount }] = await db.select({ n: count() }).from(skus).where(eq(skus.locationId, id));
  const [{ n: draftCount }] = await db
    .select({ n: count() })
    .from(listingDrafts)
    .where(eq(listingDrafts.locationId, id));
  if (skuCount > 0) return { error: `還有 ${skuCount} 個貨號放在這個儲位，先把它們移到別的儲位。` };
  if (draftCount > 0) return { error: `還有 ${draftCount} 份上架草稿用到這個儲位。` };
  await db.delete(locations).where(eq(locations.id, id));
  redirect("/locations");
}
