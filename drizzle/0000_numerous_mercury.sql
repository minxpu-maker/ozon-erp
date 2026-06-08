CREATE TABLE "accounts" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" varchar(20) NOT NULL,
	"name" varchar(64),
	"avatar_url" text,
	"role_id" varchar(36),
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "accounts_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "ahp_weights" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" integer,
	"category_name" varchar(200),
	"selection_mode" varchar(20) NOT NULL,
	"judgment_matrix" jsonb NOT NULL,
	"weight_vector" jsonb NOT NULL,
	"consistency_ratio" numeric(5, 4),
	"entropy_weights" jsonb,
	"combined_weights" jsonb,
	"alpha" numeric(3, 2) DEFAULT '0.50',
	"strategy" varchar(30),
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "data_source_health" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" varchar(30) NOT NULL,
	"status" varchar(20) NOT NULL,
	"last_check_at" timestamp NOT NULL,
	"last_success_at" timestamp,
	"response_time" integer,
	"error_rate" numeric(5, 2),
	"error_message" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "eac_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"seller_type" varchar(20) NOT NULL,
	"policy" varchar(10) NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	"updated_by" varchar(50)
);
--> statement-breakpoint
CREATE TABLE "finance_records" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" varchar(36) NOT NULL,
	"ozon_settlement_amount" numeric(12, 2),
	"settlement_at" timestamp with time zone,
	"purchase_cost" numeric(12, 2) DEFAULT '0',
	"domestic_shipping_cost" numeric(12, 2) DEFAULT '0',
	"package_cost" numeric(12, 2) DEFAULT '0',
	"ozon_commission" numeric(12, 2) DEFAULT '0',
	"other_cost" numeric(12, 2) DEFAULT '0',
	"after_sale_loss" numeric(12, 2) DEFAULT '0',
	"gross_profit" numeric(12, 2) DEFAULT '0',
	"net_profit" numeric(12, 2) DEFAULT '0',
	"is_settled" boolean DEFAULT false NOT NULL,
	"settled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "health_check" (
	"id" serial NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "image_sets" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_card_id" integer NOT NULL,
	"variant_id" integer,
	"original_images" jsonb NOT NULL,
	"processed_images" jsonb,
	"primary_image_index" integer DEFAULT 0,
	"template_id" integer,
	"ai_edit_provider" varchar(50),
	"ai_edit_params" jsonb,
	"compliance_checks" jsonb,
	"status" varchar(20) DEFAULT 'created',
	"reviewer_id" varchar(50),
	"reviewed_at" timestamp,
	"reject_reason" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "image_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"type" varchar(30) NOT NULL,
	"config" jsonb NOT NULL,
	"ozon_spec" jsonb,
	"preview_image_key" varchar(500),
	"applicable_category_ids" jsonb,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "inspection_records" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" varchar(36) NOT NULL,
	"purchase_task_id" varchar(36),
	"scanned_tracking_number" varchar(64),
	"scan_time" timestamp with time zone,
	"result" varchar(20) NOT NULL,
	"inspected_quantity" integer DEFAULT 0,
	"failed_quantity" integer DEFAULT 0,
	"has_issue" boolean DEFAULT false NOT NULL,
	"issue_type" varchar(32),
	"issue_description" text,
	"has_after_sale_ticket" boolean DEFAULT false NOT NULL,
	"after_sale_ticket_id" varchar(36),
	"inspected_by" varchar(36),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sku_id" varchar(36) NOT NULL,
	"warehouse_id" varchar(36) NOT NULL,
	"location_id" varchar(36),
	"quantity" integer DEFAULT 0 NOT NULL,
	"reserved_quantity" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "inventory_logs" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sku_id" varchar(36) NOT NULL,
	"warehouse_id" varchar(36) NOT NULL,
	"type" varchar(20) NOT NULL,
	"quantity" integer NOT NULL,
	"before_quantity" integer NOT NULL,
	"after_quantity" integer NOT NULL,
	"ref_type" varchar(32),
	"ref_id" varchar(36),
	"remark" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listing_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_card_id" integer NOT NULL,
	"shop_id" varchar(36) NOT NULL,
	"variant_id" integer,
	"ozon_task_id" integer,
	"ozon_product_id" varchar(50),
	"status" varchar(20) DEFAULT 'created',
	"logistics_template_id" integer,
	"package_weight" numeric(8, 2),
	"package_dimensions" jsonb,
	"result_message" text,
	"last_poll_at" timestamp,
	"failure_reason" text,
	"retry_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(50) NOT NULL,
	"type" varchar(30) NOT NULL,
	"severity" varchar(10) NOT NULL,
	"title" varchar(200) NOT NULL,
	"body" text,
	"related_entity_type" varchar(30),
	"related_entity_id" integer,
	"is_read" boolean DEFAULT false,
	"read_at" timestamp,
	"action_type" varchar(30),
	"action_data" jsonb,
	"action_completed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "operation_logs" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" varchar(36),
	"action" varchar(64) NOT NULL,
	"module" varchar(32) NOT NULL,
	"ref_type" varchar(32),
	"ref_id" varchar(36),
	"detail" jsonb,
	"ip_address" varchar(45),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opportunities" (
	"id" serial PRIMARY KEY NOT NULL,
	"shop_id" varchar(36) NOT NULL,
	"source" varchar(20) NOT NULL,
	"selection_mode" varchar(20) NOT NULL,
	"target_type" varchar(20) NOT NULL,
	"target_category_id" integer,
	"target_product_id" integer,
	"target_name" varchar(500),
	"market_analysis" jsonb,
	"profit_estimate" jsonb,
	"risk_flags" jsonb,
	"status" varchar(20) DEFAULT 'discovered',
	"confirmed_at" timestamp,
	"abandoned_reason" text,
	"assigned_to" varchar(50),
	"parent_opportunity_id" integer,
	"data_sources" jsonb,
	"strategy_template_id" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" varchar(36) NOT NULL,
	"sku" varchar(128) NOT NULL,
	"name" varchar(256) NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"price" numeric(12, 2) DEFAULT '0' NOT NULL,
	"ozon_offer_id" varchar(128),
	"ozon_product_id" integer,
	"source_type" varchar(20),
	"source_url" text,
	"source_price" numeric(12, 2),
	"inspected_quantity" integer DEFAULT 0,
	"is_inspected" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "order_sync_logs" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" varchar(36) NOT NULL,
	"sync_type" varchar(20) NOT NULL,
	"status" varchar(20) NOT NULL,
	"orders_fetched" integer DEFAULT 0,
	"orders_created" integer DEFAULT 0,
	"orders_updated" integer DEFAULT 0,
	"error_message" text,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ozon_order_id" varchar(64) NOT NULL,
	"ozon_posting_number" varchar(64) NOT NULL,
	"shop_id" varchar(36) NOT NULL,
	"status" varchar(32) DEFAULT 'awaiting_packaging' NOT NULL,
	"buyer_name" varchar(128),
	"buyer_phone" varchar(32),
	"recipient_name" varchar(128),
	"recipient_phone" varchar(32),
	"recipient_city" varchar(64),
	"recipient_address" text,
	"total_price" numeric(12, 2) DEFAULT '0' NOT NULL,
	"products_price" numeric(12, 2) DEFAULT '0' NOT NULL,
	"delivery_price" numeric(12, 2) DEFAULT '0' NOT NULL,
	"tracking_number" varchar(64),
	"shipped_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"is_purchase_bound" boolean DEFAULT false NOT NULL,
	"purchase_bound_at" timestamp with time zone,
	"is_inspected" boolean DEFAULT false NOT NULL,
	"inspected_at" timestamp with time zone,
	"is_packed" boolean DEFAULT false NOT NULL,
	"packed_at" timestamp with time zone,
	"package_weight" numeric(8, 3),
	"is_settled" boolean DEFAULT false NOT NULL,
	"settled_at" timestamp with time zone,
	"purchase_price" numeric(12, 2) DEFAULT '0',
	"ozon_raw_data" jsonb,
	"ozon_created_at" timestamp with time zone,
	"ozon_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "orders_ozon_order_id_unique" UNIQUE("ozon_order_id")
);
--> statement-breakpoint
CREATE TABLE "ozon_knowledge_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"domain" varchar(50) NOT NULL,
	"category_id" integer,
	"data" jsonb NOT NULL,
	"data_hash" varchar(64) NOT NULL,
	"synced_at" timestamp DEFAULT now(),
	"sync_source" varchar(50),
	"api_endpoint" varchar(200),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ozon_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"ozon_product_id" bigint NOT NULL,
	"offer_id" varchar(128) NOT NULL,
	"name" varchar(512) NOT NULL,
	"description" text,
	"main_image" text,
	"images" jsonb DEFAULT '[]'::jsonb,
	"attributes" jsonb DEFAULT '[]'::jsonb,
	"price" varchar(32),
	"old_price" varchar(32),
	"marketing_price" varchar(32),
	"stock" integer DEFAULT 0,
	"reserved" integer DEFAULT 0,
	"status" varchar(32) DEFAULT 'active',
	"is_visible" boolean DEFAULT true,
	"barcode" varchar(64),
	"weight" varchar(32),
	"height" varchar(32),
	"width" varchar(32),
	"depth" varchar(32),
	"raw_data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "packaging_records" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" varchar(36) NOT NULL,
	"weight" numeric(8, 3),
	"weigh_time" timestamp with time zone,
	"label_printed" boolean DEFAULT false NOT NULL,
	"label_printed_at" timestamp with time zone,
	"package_type" varchar(32),
	"package_cost" numeric(8, 2) DEFAULT '0',
	"packed_by" varchar(36),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "policy_change_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"domain" varchar(50) NOT NULL,
	"severity" varchar(10) NOT NULL,
	"change_summary" text NOT NULL,
	"before_data" jsonb,
	"after_data" jsonb,
	"affected_categories" jsonb,
	"affected_products" jsonb,
	"algorithm_impact" jsonb,
	"suggested_action" text,
	"effective_date" timestamp,
	"notified_at" timestamp,
	"acknowledged_at" timestamp,
	"acknowledged_by" varchar(50),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "product_cards" (
	"id" serial PRIMARY KEY NOT NULL,
	"shop_id" varchar(36) NOT NULL,
	"opportunity_id" integer,
	"ozon_category_id" integer NOT NULL,
	"ozon_category_name" varchar(500),
	"title_ru" varchar(500),
	"title_zh" varchar(500),
	"description_ru" text,
	"attributes" jsonb,
	"variant_attributes" jsonb,
	"suggested_price" integer,
	"cost_price" integer,
	"commission_rate" numeric(5, 2),
	"status" varchar(20) DEFAULT 'draft',
	"is_eac_required" boolean DEFAULT false,
	"eac_status" varchar(20) DEFAULT 'none',
	"source_1688_url" text,
	"source_ozon_url" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "product_embeddings" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"embedding" jsonb,
	"embedding_source" varchar(50),
	"model" varchar(50) DEFAULT 'text-embedding-3-small',
	"text_hash" varchar(64),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "product_scores" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"shop_id" varchar(36) NOT NULL,
	"opportunity_id" integer,
	"shop_stage" varchar(20),
	"seller_type" varchar(20),
	"selection_mode" varchar(20),
	"hard_constraint_discount" numeric(3, 2) DEFAULT '1.00',
	"hard_constraint_details" jsonb,
	"ahp_weights" jsonb,
	"entropy_weights" jsonb,
	"combined_weights" jsonb,
	"topsis_score" numeric(5, 4),
	"demand_score" numeric(5, 4),
	"competition_score" numeric(5, 4),
	"profit_score" numeric(5, 4),
	"supply_score" numeric(5, 4),
	"risk_score" numeric(5, 4),
	"semantic_score" numeric(5, 4),
	"predicted_sales_7d" integer,
	"predicted_sales_30d" integer,
	"trend_direction" varchar(10),
	"trend_changepoints" jsonb,
	"opportunity_index" numeric(5, 4),
	"cross_verify_discount" numeric(3, 2) DEFAULT '1.00',
	"cross_verify_result" jsonb,
	"composite_score" numeric(5, 4),
	"grade" varchar(1),
	"follow_signal" varchar(20),
	"seller_count_on_shelf" integer,
	"differentiation_score" numeric(5, 4),
	"negative_review_keywords" jsonb,
	"eac_risk_level" varchar(10),
	"llm_insight" jsonb,
	"calculated_at" timestamp DEFAULT now(),
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "product_variants" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_card_id" integer NOT NULL,
	"variant_name" varchar(200),
	"variant_values" jsonb NOT NULL,
	"ozon_variant_id" varchar(50),
	"confirmed_price" integer,
	"cost_price" integer,
	"stock" integer DEFAULT 0,
	"primary_image_set_id" integer,
	"status" varchar(20) DEFAULT 'draft',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "prophet_forecasts" (
	"id" serial PRIMARY KEY NOT NULL,
	"target_type" varchar(10) NOT NULL,
	"target_id" integer NOT NULL,
	"target_name" varchar(200),
	"forecast_date" date NOT NULL,
	"predicted_value" numeric(10, 2),
	"lower_bound" numeric(10, 2),
	"upper_bound" numeric(10, 2),
	"trend_direction" varchar(10),
	"changepoints" jsonb,
	"holidays" jsonb,
	"model_params" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "purchase_tasks" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" varchar(36) NOT NULL,
	"order_item_id" varchar(36) NOT NULL,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"sku_id" varchar(36),
	"sku_code" varchar(128) NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"source_type" varchar(20),
	"source_url" text,
	"source_price" numeric(12, 2),
	"purchase_amount" numeric(12, 2),
	"shipping_fee" numeric(12, 2) DEFAULT '0',
	"is_bound" boolean DEFAULT false NOT NULL,
	"domestic_tracking_number" varchar(64),
	"bound_at" timestamp with time zone,
	"bound_by" varchar(36),
	"purchased_at" timestamp with time zone,
	"received_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(32) NOT NULL,
	"code" varchar(32) NOT NULL,
	"description" text,
	"level" integer DEFAULT 0,
	"permissions" jsonb,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "roles_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "selection_retrospectives" (
	"id" serial PRIMARY KEY NOT NULL,
	"shop_id" varchar(36) NOT NULL,
	"opportunity_id" integer,
	"product_card_id" integer,
	"selected_at" timestamp,
	"listed_at" timestamp,
	"first_order_at" timestamp,
	"actual_sales_7d" integer,
	"actual_sales_30d" integer,
	"predicted_sales_7d" integer,
	"predicted_sales_30d" integer,
	"accuracy_score" numeric(5, 2),
	"actual_margin" numeric(5, 2),
	"grade" varchar(1),
	"actual_performance" varchar(20),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "selection_strategy_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"shop_id" varchar(36),
	"name" varchar(200) NOT NULL,
	"selection_mode" varchar(20) NOT NULL,
	"ahp_config" jsonb,
	"hard_constraints" jsonb,
	"price_range_min" integer,
	"price_range_max" integer,
	"is_default" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "shops" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(128) NOT NULL,
	"client_id" varchar(64) NOT NULL,
	"api_key" varchar(128) NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_sync_at" timestamp with time zone,
	"seller_type" varchar(20) DEFAULT 'cn_crossborder',
	"current_stage" varchar(20) DEFAULT 'new',
	"selection_mode" varchar(20) DEFAULT 'follow',
	"price_range_min" integer DEFAULT 200,
	"price_range_max" integer DEFAULT 1500,
	"api_rate_limit_remaining" integer,
	"api_rate_limit_reset_at" timestamp with time zone,
	"default_logistics_template_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sku_sources" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sku_id" varchar(36) NOT NULL,
	"supplier_id" varchar(36) NOT NULL,
	"source_url" text NOT NULL,
	"source_price" numeric(12, 2),
	"is_preferred" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skus" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sku_code" varchar(128) NOT NULL,
	"name" varchar(256) NOT NULL,
	"description" text,
	"category" varchar(64),
	"image_url" text,
	"ozon_offer_id" varchar(128),
	"ozon_product_id" integer,
	"default_source_type" varchar(20),
	"default_source_url" text,
	"default_source_price" numeric(12, 2),
	"cost_price" numeric(12, 2),
	"selling_price" numeric(12, 2),
	"safety_stock" integer DEFAULT 0,
	"is_stocked" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "skus_sku_code_unique" UNIQUE("sku_code")
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(128) NOT NULL,
	"contact_name" varchar(64),
	"contact_phone" varchar(32),
	"contact_wechat" varchar(64),
	"platform" varchar(20) NOT NULL,
	"shop_url" text,
	"shop_name" varchar(128),
	"rating" numeric(2, 1) DEFAULT '3.0',
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sync_schedules" (
	"id" serial PRIMARY KEY NOT NULL,
	"domain" varchar(50) NOT NULL,
	"api_endpoint" varchar(200),
	"cron_expression" varchar(50),
	"frequency" varchar(20),
	"is_active" boolean DEFAULT true,
	"last_sync_at" timestamp,
	"last_sync_status" varchar(20),
	"last_error" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "system_configs" (
	"key" varchar(64) PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"description" varchar(256),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "warehouse_locations" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"warehouse_id" varchar(36) NOT NULL,
	"code" varchar(32) NOT NULL,
	"zone" varchar(16),
	"row" integer,
	"column" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "warehouses" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(64) NOT NULL,
	"code" varchar(32) NOT NULL,
	"address" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "warehouses_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_records" ADD CONSTRAINT "finance_records_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_sets" ADD CONSTRAINT "image_sets_product_card_id_product_cards_id_fk" FOREIGN KEY ("product_card_id") REFERENCES "public"."product_cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_sets" ADD CONSTRAINT "image_sets_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_sets" ADD CONSTRAINT "image_sets_template_id_image_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."image_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_records" ADD CONSTRAINT "inspection_records_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_records" ADD CONSTRAINT "inspection_records_purchase_task_id_purchase_tasks_id_fk" FOREIGN KEY ("purchase_task_id") REFERENCES "public"."purchase_tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_sku_id_skus_id_fk" FOREIGN KEY ("sku_id") REFERENCES "public"."skus"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_location_id_warehouse_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."warehouse_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_tasks" ADD CONSTRAINT "listing_tasks_product_card_id_product_cards_id_fk" FOREIGN KEY ("product_card_id") REFERENCES "public"."product_cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_tasks" ADD CONSTRAINT "listing_tasks_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_tasks" ADD CONSTRAINT "listing_tasks_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_sync_logs" ADD CONSTRAINT "order_sync_logs_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ozon_products" ADD CONSTRAINT "ozon_products_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packaging_records" ADD CONSTRAINT "packaging_records_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_cards" ADD CONSTRAINT "product_cards_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_cards" ADD CONSTRAINT "product_cards_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_embeddings" ADD CONSTRAINT "product_embeddings_product_id_product_cards_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product_cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_scores" ADD CONSTRAINT "product_scores_product_id_product_cards_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product_cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_scores" ADD CONSTRAINT "product_scores_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_scores" ADD CONSTRAINT "product_scores_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_card_id_product_cards_id_fk" FOREIGN KEY ("product_card_id") REFERENCES "public"."product_cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_tasks" ADD CONSTRAINT "purchase_tasks_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_tasks" ADD CONSTRAINT "purchase_tasks_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_tasks" ADD CONSTRAINT "purchase_tasks_sku_id_skus_id_fk" FOREIGN KEY ("sku_id") REFERENCES "public"."skus"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "selection_retrospectives" ADD CONSTRAINT "selection_retrospectives_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "selection_retrospectives" ADD CONSTRAINT "selection_retrospectives_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "selection_retrospectives" ADD CONSTRAINT "selection_retrospectives_product_card_id_product_cards_id_fk" FOREIGN KEY ("product_card_id") REFERENCES "public"."product_cards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "selection_strategy_templates" ADD CONSTRAINT "selection_strategy_templates_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sku_sources" ADD CONSTRAINT "sku_sources_sku_id_skus_id_fk" FOREIGN KEY ("sku_id") REFERENCES "public"."skus"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sku_sources" ADD CONSTRAINT "sku_sources_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_locations" ADD CONSTRAINT "warehouse_locations_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_phone_idx" ON "accounts" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "accounts_role_id_idx" ON "accounts" USING btree ("role_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_ahp_weights_category_mode" ON "ahp_weights" USING btree ("category_id","selection_mode","strategy");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_data_source_health_source" ON "data_source_health" USING btree ("source");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_eac_config_seller_type" ON "eac_config" USING btree ("seller_type");--> statement-breakpoint
CREATE INDEX "finance_records_order_id_idx" ON "finance_records" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "finance_records_settled_at_idx" ON "finance_records" USING btree ("settled_at");--> statement-breakpoint
CREATE INDEX "idx_image_sets_product_card_id" ON "image_sets" USING btree ("product_card_id");--> statement-breakpoint
CREATE INDEX "idx_image_templates_type" ON "image_templates" USING btree ("type");--> statement-breakpoint
CREATE INDEX "inspection_records_order_id_idx" ON "inspection_records" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "inspection_records_scanned_tracking_idx" ON "inspection_records" USING btree ("scanned_tracking_number");--> statement-breakpoint
CREATE INDEX "inventory_sku_id_idx" ON "inventory" USING btree ("sku_id");--> statement-breakpoint
CREATE INDEX "inventory_warehouse_id_idx" ON "inventory" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "inventory_logs_sku_id_idx" ON "inventory_logs" USING btree ("sku_id");--> statement-breakpoint
CREATE INDEX "inventory_logs_created_at_idx" ON "inventory_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_listing_tasks_product_card_id" ON "listing_tasks" USING btree ("product_card_id");--> statement-breakpoint
CREATE INDEX "idx_listing_tasks_shop_id" ON "listing_tasks" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "idx_listing_tasks_status" ON "listing_tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_notifications_user_id" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_notifications_is_read" ON "notifications" USING btree ("is_read");--> statement-breakpoint
CREATE INDEX "operation_logs_account_id_idx" ON "operation_logs" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "operation_logs_created_at_idx" ON "operation_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_opportunities_shop_id" ON "opportunities" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "idx_opportunities_status" ON "opportunities" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_opportunities_category" ON "opportunities" USING btree ("target_category_id");--> statement-breakpoint
CREATE INDEX "order_items_order_id_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_items_sku_idx" ON "order_items" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "order_sync_logs_shop_id_idx" ON "order_sync_logs" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "order_sync_logs_created_at_idx" ON "order_sync_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "orders_ozon_order_id_idx" ON "orders" USING btree ("ozon_order_id");--> statement-breakpoint
CREATE INDEX "orders_shop_id_idx" ON "orders" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "orders_created_at_idx" ON "orders" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "orders_status_created_idx" ON "orders" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_knowledge_domain_category" ON "ozon_knowledge_cache" USING btree ("domain","category_id");--> statement-breakpoint
CREATE INDEX "packaging_records_order_id_idx" ON "packaging_records" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_policy_change_severity" ON "policy_change_events" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "idx_policy_change_domain" ON "policy_change_events" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "idx_product_cards_shop_id" ON "product_cards" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "idx_product_cards_status" ON "product_cards" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_product_cards_category" ON "product_cards" USING btree ("ozon_category_id");--> statement-breakpoint
CREATE INDEX "idx_product_embeddings_product_id" ON "product_embeddings" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_product_scores_product_id" ON "product_scores" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_product_scores_shop_id" ON "product_scores" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "idx_product_scores_grade" ON "product_scores" USING btree ("grade");--> statement-breakpoint
CREATE INDEX "idx_product_variants_product_card_id" ON "product_variants" USING btree ("product_card_id");--> statement-breakpoint
CREATE INDEX "idx_prophet_target" ON "prophet_forecasts" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "idx_prophet_date" ON "prophet_forecasts" USING btree ("forecast_date");--> statement-breakpoint
CREATE INDEX "purchase_tasks_order_id_idx" ON "purchase_tasks" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "purchase_tasks_status_idx" ON "purchase_tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "purchase_tasks_sku_code_idx" ON "purchase_tasks" USING btree ("sku_code");--> statement-breakpoint
CREATE INDEX "purchase_tasks_domestic_tracking_idx" ON "purchase_tasks" USING btree ("domestic_tracking_number");--> statement-breakpoint
CREATE INDEX "idx_retrospectives_shop_id" ON "selection_retrospectives" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "idx_retrospectives_grade" ON "selection_retrospectives" USING btree ("grade");--> statement-breakpoint
CREATE INDEX "idx_strategy_templates_shop_mode" ON "selection_strategy_templates" USING btree ("shop_id","selection_mode");--> statement-breakpoint
CREATE INDEX "shops_client_id_idx" ON "shops" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "shops_is_active_idx" ON "shops" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "sku_sources_sku_id_idx" ON "sku_sources" USING btree ("sku_id");--> statement-breakpoint
CREATE INDEX "sku_sources_supplier_id_idx" ON "sku_sources" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "skus_sku_code_idx" ON "skus" USING btree ("sku_code");--> statement-breakpoint
CREATE INDEX "skus_ozon_offer_id_idx" ON "skus" USING btree ("ozon_offer_id");--> statement-breakpoint
CREATE INDEX "skus_category_idx" ON "skus" USING btree ("category");--> statement-breakpoint
CREATE INDEX "suppliers_platform_idx" ON "suppliers" USING btree ("platform");--> statement-breakpoint
CREATE INDEX "suppliers_name_idx" ON "suppliers" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_sync_schedules_domain" ON "sync_schedules" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "warehouse_locations_warehouse_id_idx" ON "warehouse_locations" USING btree ("warehouse_id");