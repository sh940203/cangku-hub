CREATE TABLE `bundle_components` (
	`bundle_sku_id` integer NOT NULL,
	`component_sku_id` integer NOT NULL,
	`qty` integer NOT NULL,
	PRIMARY KEY(`bundle_sku_id`, `component_sku_id`),
	FOREIGN KEY (`bundle_sku_id`) REFERENCES `skus`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`component_sku_id`) REFERENCES `skus`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `import_batches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`platform` text NOT NULL,
	`filename` text NOT NULL,
	`row_count` integer DEFAULT 0 NOT NULL,
	`matched_count` integer DEFAULT 0 NOT NULL,
	`unmatched_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `listing_drafts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer,
	`photo_keys` text DEFAULT '[]' NOT NULL,
	`reference_text` text,
	`notes` text,
	`weight_g` integer,
	`length_cm` real,
	`width_cm` real,
	`height_cm` real,
	`location_id` integer,
	`generated` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `locations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`floor` text NOT NULL,
	`zone` text NOT NULL,
	`description` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `locations_code_unique` ON `locations` (`code`);--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`sku_id` integer,
	`raw_sku_code` text,
	`raw_name` text,
	`qty` integer NOT NULL,
	`matched` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sku_id`) REFERENCES `skus`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `order_items_order_idx` ON `order_items` (`order_id`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`platform` text NOT NULL,
	`platform_order_no` text NOT NULL,
	`status` text NOT NULL,
	`ordered_at` integer,
	`import_batch_id` integer,
	FOREIGN KEY (`import_batch_id`) REFERENCES `import_batches`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_platform_no_uq` ON `orders` (`platform`,`platform_order_no`);--> statement-breakpoint
CREATE TABLE `platform_listings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sku_id` integer NOT NULL,
	`platform` text NOT NULL,
	`platform_item_id` text,
	`platform_variant_id` text,
	`last_pushed_stock` integer,
	`last_pushed_at` integer,
	FOREIGN KEY (`sku_id`) REFERENCES `skus`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `platform_listings_sku_platform_uq` ON `platform_listings` (`sku_id`,`platform`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`category` text,
	`notes` text,
	`weight_g` integer,
	`length_cm` real,
	`width_cm` real,
	`height_cm` real,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `skus` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`product_id` integer NOT NULL,
	`variant_name` text,
	`is_bundle` integer DEFAULT false NOT NULL,
	`stock` integer,
	`safety_stock` integer,
	`location_id` integer,
	`barcode` text,
	`status` text DEFAULT 'active' NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `skus_code_unique` ON `skus` (`code`);--> statement-breakpoint
CREATE INDEX `skus_product_idx` ON `skus` (`product_id`);--> statement-breakpoint
CREATE INDEX `skus_barcode_idx` ON `skus` (`barcode`);--> statement-breakpoint
CREATE TABLE `stock_movements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sku_id` integer NOT NULL,
	`delta` integer NOT NULL,
	`reason` text NOT NULL,
	`ref_type` text NOT NULL,
	`ref_id` text,
	`note` text,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`sku_id`) REFERENCES `skus`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stock_movements_ref_uq` ON `stock_movements` (`ref_type`,`ref_id`,`sku_id`,`reason`);--> statement-breakpoint
CREATE INDEX `stock_movements_sku_idx` ON `stock_movements` (`sku_id`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`detail` text,
	`status` text DEFAULT 'inbox' NOT NULL,
	`due_date` text,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL
);
