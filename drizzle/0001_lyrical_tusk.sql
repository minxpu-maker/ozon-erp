CREATE TABLE "extension_api_keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"key_hash" varchar(64) NOT NULL,
	"key_prefix" varchar(8) NOT NULL,
	"shop_id" varchar(36) NOT NULL,
	"user_id" varchar(50) NOT NULL,
	"permissions" jsonb DEFAULT '["read:signals", "write:signals"]'::jsonb,
	"device_info" varchar(200),
	"last_used_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "market_signals" (
	"id" serial PRIMARY KEY NOT NULL,
	"shop_id" varchar(36) NOT NULL,
	"ozon_product_id" varchar(50) NOT NULL,
	"product_title" varchar(500) NOT NULL,
	"product_title_zh" varchar(500),
	"image_url" varchar(1000),
	"images" jsonb,
	"brand_name" varchar(200),
	"previous_signal_id" integer,
	"current_price" numeric(12, 2),
	"original_price" numeric(12, 2),
	"discount_percent" numeric(5, 2),
	"monthly_sales" integer DEFAULT 0,
	"rating" numeric(3, 2),
	"reviews_count" integer DEFAULT 0,
	"seller_count" integer DEFAULT 0,
	"is_ozon_seller" boolean DEFAULT false,
	"category_id" varchar(50),
	"category_name" varchar(200),
	"source_url" varchar(1000),
	"collected_at" timestamp with time zone DEFAULT now(),
	"raw_data" jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "shops" ADD COLUMN "ozon_client_id" varchar(64);--> statement-breakpoint
ALTER TABLE "shops" ADD COLUMN "ozon_api_key" varchar(128);--> statement-breakpoint
ALTER TABLE "extension_api_keys" ADD CONSTRAINT "extension_api_keys_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_signals" ADD CONSTRAINT "market_signals_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_ext_api_key_hash" ON "extension_api_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "idx_ext_api_key_shop" ON "extension_api_keys" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "idx_market_signals_shop" ON "market_signals" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "idx_market_signals_product" ON "market_signals" USING btree ("ozon_product_id");--> statement-breakpoint
CREATE INDEX "idx_market_signals_collected" ON "market_signals" USING btree ("collected_at");