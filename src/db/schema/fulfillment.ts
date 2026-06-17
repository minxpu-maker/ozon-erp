import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer, numeric, jsonb, index } from "drizzle-orm/pg-core";

// ============================================================================
// 店铺表 (Shops) - 包含Webhook配置
// ============================================================================
export const shops = pgTable(
  "shops",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    name: varchar("name", { length: 128 }).notNull(),
    clientId: varchar("client_id", { length: 64 }).notNull(),
    apiKey: varchar("api_key", { length: 128 }).notNull(),
    ozonClientId: varchar("ozon_client_id", { length: 64 }),
    ozonApiKey: varchar("ozon_api_key", { length: 128 }),
    platform: varchar("platform", { length: 20 }).default('ozon'),
    isPrimary: boolean("is_primary").default(false).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    sellerType: varchar("seller_type", { length: 20 }).default('cn_crossborder'),
    currentStage: varchar("current_stage", { length: 20 }).default('new'),
    selectionMode: varchar("selection_mode", { length: 20 }).default('follow'),
    priceRangeMin: integer("price_range_min").default(200),
    priceRangeMax: integer("price_range_max").default(1500),
    apiRateLimitRemaining: integer("api_rate_limit_remaining"),
    apiRateLimitResetAt: timestamp("api_rate_limit_reset_at", { withTimezone: true }),
    defaultLogisticsTemplateId: integer("default_logistics_template_id"),
    syncEnabled: boolean("sync_enabled").default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
    // Webhook配置（B04-1新增）
    webhookUrl: text('webhook_url'),
    webhookEnabled: boolean('webhook_enabled').default(false),
  },
  (table) => [
    index("shops_client_id_idx").on(table.clientId),
    index("shops_is_active_idx").on(table.isActive),
  ]
);

// ============================================================================
// Webhook日志表 (Webhook Logs)
// ============================================================================
export const webhookLogs = pgTable('webhook_logs', {
  id: varchar('id', { length: 36 }).primaryKey(),
  shopId: varchar('shop_id', { length: 36 }),
  messageId: varchar('message_id', { length: 100 }),
  eventType: varchar('event_type', { length: 50 }).notNull(),
  postingNumber: varchar('posting_number', { length: 100 }),
  orderId: varchar('order_id', { length: 36 }),
  rawPayload: jsonb('raw_payload').notNull(),
  processed: boolean('processed').default(false),
  isRead: boolean('is_read').default(false),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index("idx_webhook_logs_shop_id").on(table.shopId),
  index("idx_webhook_logs_posting_number").on(table.postingNumber),
  index("idx_webhook_logs_event_type").on(table.eventType),
]);
