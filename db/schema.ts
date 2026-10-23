// Drizzle schema, following docs/系統結構規劃.md section 4.
// Timestamps are unix milliseconds. Enum-like text columns are type-checked only (no DB CHECK).
import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const PLATFORMS = ["shopee", "ruten", "yahoo", "coupang"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const MOVEMENT_REASONS = [
  "order",
  "cancel",
  "restock",
  "return",
  "damage",
  "owner_take",
  "adjust",
  "initial",
] as const;
export const MOVEMENT_REF_TYPES = ["order_item", "import_batch", "manual"] as const;

const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch('subsec') * 1000)`);
const updatedAt = () =>
  integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch('subsec') * 1000)`)
    .$onUpdate(() => new Date());

export const locations = sqliteTable("locations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(), // e.g. 4F-T-03
  floor: text("floor", { enum: ["1F", "3F", "4F"] }).notNull(),
  zone: text("zone").notNull(), // A, L, S, T ...
  description: text("description"),
});

export const products = sqliteTable("products", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  category: text("category"),
  notes: text("notes"),
  weightG: integer("weight_g"),
  lengthCm: real("length_cm"),
  widthCm: real("width_cm"),
  heightCm: real("height_cm"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const skus = sqliteTable(
  "skus",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    code: text("code").notNull().unique(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id),
    variantName: text("variant_name"),
    isBundle: integer("is_bundle", { mode: "boolean" }).notNull().default(false),
    // Cache of sum(stock_movements.delta). Null for bundles, which hold no stock.
    stock: integer("stock"),
    // Null for bundles: restock applies to physical components only.
    safetyStock: integer("safety_stock"),
    // Null for bundles: their components carry the locations.
    locationId: integer("location_id").references(() => locations.id),
    barcode: text("barcode"),
    status: text("status", { enum: ["active", "archived"] }).notNull().default("active"),
  },
  (t) => [index("skus_product_idx").on(t.productId), index("skus_barcode_idx").on(t.barcode)],
);

export const bundleComponents = sqliteTable(
  "bundle_components",
  {
    bundleSkuId: integer("bundle_sku_id")
      .notNull()
      .references(() => skus.id),
    componentSkuId: integer("component_sku_id")
      .notNull()
      .references(() => skus.id),
    qty: integer("qty").notNull(),
  },
  (t) => [primaryKey({ columns: [t.bundleSkuId, t.componentSkuId] })],
);

export const platformListings = sqliteTable(
  "platform_listings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    skuId: integer("sku_id")
      .notNull()
      .references(() => skus.id),
    platform: text("platform", { enum: PLATFORMS }).notNull(),
    platformItemId: text("platform_item_id"),
    platformVariantId: text("platform_variant_id"),
    lastPushedStock: integer("last_pushed_stock"),
    lastPushedAt: integer("last_pushed_at", { mode: "timestamp_ms" }),
  },
  (t) => [uniqueIndex("platform_listings_sku_platform_uq").on(t.skuId, t.platform)],
);

export const stockMovements = sqliteTable(
  "stock_movements",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    // Physical SKUs only, never a bundle.
    skuId: integer("sku_id")
      .notNull()
      .references(() => skus.id),
    delta: integer("delta").notNull(),
    reason: text("reason", { enum: MOVEMENT_REASONS }).notNull(),
    refType: text("ref_type", { enum: MOVEMENT_REF_TYPES }).notNull(),
    // Null for manual movements; SQLite treats NULLs as distinct, so repeated adjusts are allowed.
    refId: text("ref_id"),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [
    // Re-importing the same order must not deduct stock twice.
    uniqueIndex("stock_movements_ref_uq").on(t.refType, t.refId, t.skuId, t.reason),
    index("stock_movements_sku_idx").on(t.skuId),
  ],
);

export const importBatches = sqliteTable("import_batches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  platform: text("platform", { enum: PLATFORMS }).notNull(),
  filename: text("filename").notNull(),
  rowCount: integer("row_count").notNull().default(0),
  matchedCount: integer("matched_count").notNull().default(0),
  unmatchedCount: integer("unmatched_count").notNull().default(0),
  createdAt: createdAt(),
});

// No customer PII is ever stored here.
export const orders = sqliteTable(
  "orders",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    platform: text("platform", { enum: PLATFORMS }).notNull(),
    platformOrderNo: text("platform_order_no").notNull(),
    status: text("status").notNull(),
    orderedAt: integer("ordered_at", { mode: "timestamp_ms" }),
    importBatchId: integer("import_batch_id").references(() => importBatches.id),
  },
  (t) => [uniqueIndex("orders_platform_no_uq").on(t.platform, t.platformOrderNo)],
);

export const orderItems = sqliteTable(
  "order_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id),
    skuId: integer("sku_id").references(() => skus.id),
    rawSkuCode: text("raw_sku_code"),
    rawName: text("raw_name"),
    qty: integer("qty").notNull(),
    matched: integer("matched", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [index("order_items_order_idx").on(t.orderId)],
);

export const tasks = sqliteTable("tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  detail: text("detail"),
  status: text("status", { enum: ["inbox", "todo", "ask_boss", "done"] })
    .notNull()
    .default("inbox"),
  dueDate: text("due_date"), // YYYY-MM-DD
  createdAt: createdAt(),
});

export const listingDrafts = sqliteTable("listing_drafts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  productId: integer("product_id").references(() => products.id),
  photoKeys: text("photo_keys", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
  referenceText: text("reference_text"),
  notes: text("notes"),
  weightG: integer("weight_g"),
  lengthCm: real("length_cm"),
  widthCm: real("width_cm"),
  heightCm: real("height_cm"),
  locationId: integer("location_id").references(() => locations.id),
  generated: text("generated", { mode: "json" }).$type<Record<string, unknown>>(),
  status: text("status", { enum: ["draft", "generated", "confirmed", "exported"] })
    .notNull()
    .default("draft"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});
