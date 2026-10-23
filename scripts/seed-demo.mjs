// Seeds demo data (膠條 parts + 一車份, a tool) into an EMPTY database. Stock is written via stock_movements.
// usage: TURSO_DATABASE_URL=file:demo.db node scripts/seed-demo.mjs
import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL ?? "file:local.db";
const db = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });

const { rows } = await db.execute("select count(*) as n from skus");
if (Number(rows[0].n) > 0) {
  console.error(`${url} already has SKUs; seed-demo only runs on an empty database.`);
  process.exit(1);
}

const tx = await db.transaction("write");
const id = async (sql, args) => Number((await tx.execute({ sql: `${sql} returning id`, args })).rows[0].id);
const loc = (code, floor, zone, description = null) =>
  id("insert into locations (code, floor, zone, description) values (?, ?, ?, ?)", [code, floor, zone, description]);
const sku = (code, productId, variant, { bundle = false, locationId = null, safety = null } = {}) =>
  id(
    "insert into skus (code, product_id, variant_name, is_bundle, stock, safety_stock, location_id, barcode) values (?, ?, ?, ?, ?, ?, ?, ?)",
    [code, productId, variant, bundle ? 1 : 0, bundle ? null : 0, safety, locationId, code],
  );
const initial = async (skuId, n) => {
  await tx.execute({
    sql: "insert into stock_movements (sku_id, delta, reason, ref_type) values (?, ?, 'initial', 'manual')",
    args: [skuId, n],
  });
  await tx.execute({ sql: "update skus set stock = stock + ? where id = ?", args: [n, skuId] });
};

const t03 = await loc("4F-T-03", "4F", "T", "鐵皮屋左側第二層");
const a03 = await loc("1F-A-03", "1F", "A", "門口右邊鐵架");
await loc("3F-L-02", "3F", "L");
await loc("4F-S-01", "4F", "S", "神明廳供桌旁");

const strip = await id("insert into products (name, category) values (?, ?)", ["車門膠條 示意車型", "汽車用品"]);
const parts = [];
for (const [code, variant, n] of [["WS-FL", "前左", 5], ["WS-FR", "前右", 3], ["WS-RL", "後左", 2], ["WS-RR", "後右", 4]]) {
  const s = await sku(code, strip, variant, { locationId: t03, safety: 2 });
  await initial(s, n);
  parts.push(s);
}
const set = await sku("WS-SET", strip, "一車份", { bundle: true });
for (const p of parts) {
  await tx.execute({ sql: "insert into bundle_components (bundle_sku_id, component_sku_id, qty) values (?, ?, 1)", args: [set, p] });
}

const tool = await id("insert into products (name, category) values (?, ?)", ["棘輪扳手 72 齒", "工具"]);
await initial(await sku("TL-RW72", tool, null, { locationId: a03, safety: 1 }), 7);

await tx.commit();
console.log(`seeded demo data into ${url}`);
