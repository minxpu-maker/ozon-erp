import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer, numeric, jsonb, index, serial } from "drizzle-orm/pg-core";

// 系统健康检查表（必须保留）
export const healthCheck = pgTable("health_check", {
  id: serial().notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

// 店铺表 - 支持多店铺绑定
export const shops = pgTable(
  "shops",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    name: varchar("name", { length: 128 }).notNull(),
    client_id: varchar("client_id", { length: 64 }).notNull(),
    api_key: varchar("api_key", { length: 128 }).notNull(),
    is_primary: boolean("is_primary").default(false).notNull(),
    is_active: boolean("is_active").default(true).notNull(),
    last_sync_at: timestamp("last_sync_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("shops_client_id_idx").on(table.client_id),
    index("shops_is_active_idx").on(table.is_active),
  ]
);

// 订单主表
export const orders = pgTable(
  "orders",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    // Ozon订单信息
    ozon_order_id: varchar("ozon_order_id", { length: 64 }).notNull().unique(),
    ozon_posting_number: varchar("ozon_posting_number", { length: 64 }).notNull(),
    shop_id: varchar("shop_id", { length: 36 }).notNull().references(() => shops.id),
    
    // 订单状态
    status: varchar("status", { length: 32 }).notNull().default("awaiting_packaging"),
    // awaiting_packaging: 已付款待打包
    // awaiting_delivering: 待发货
    // delivering: 配送中
    // delivered: 已送达
    // cancelled: 已取消
    
    // 买家信息
    buyer_name: varchar("buyer_name", { length: 128 }),
    buyer_phone: varchar("buyer_phone", { length: 32 }),
    
    // 收货地址
    recipient_name: varchar("recipient_name", { length: 128 }),
    recipient_phone: varchar("recipient_phone", { length: 32 }),
    recipient_city: varchar("recipient_city", { length: 64 }),
    recipient_address: text("recipient_address"),
    
    // 金额信息
    total_price: numeric("total_price", { precision: 12, scale: 2 }).notNull().default("0"),
    products_price: numeric("products_price", { precision: 12, scale: 2 }).notNull().default("0"),
    delivery_price: numeric("delivery_price", { precision: 12, scale: 2 }).notNull().default("0"),
    
    // 物流信息
    tracking_number: varchar("tracking_number", { length: 64 }),
    shipped_at: timestamp("shipped_at", { withTimezone: true }),
    delivered_at: timestamp("delivered_at", { withTimezone: true }),
    
    // 采购绑定信息
    is_purchase_bound: boolean("is_purchase_bound").default(false).notNull(),
    purchase_bound_at: timestamp("purchase_bound_at", { withTimezone: true }),
    
    // 验货信息
    is_inspected: boolean("is_inspected").default(false).notNull(),
    inspected_at: timestamp("inspected_at", { withTimezone: true }),
    
    // 打包发货信息
    is_packed: boolean("is_packed").default(false).notNull(),
    packed_at: timestamp("packed_at", { withTimezone: true }),
    package_weight: numeric("package_weight", { precision: 8, scale: 3 }),
    
    // 利润核算
    is_settled: boolean("is_settled").default(false).notNull(),
    settled_at: timestamp("settled_at", { withTimezone: true }),
    
    // Ozon原始数据
    ozon_raw_data: jsonb("ozon_raw_data"),
    
    // 时间戳
    ozon_created_at: timestamp("ozon_created_at", { withTimezone: true }),
    ozon_updated_at: timestamp("ozon_updated_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("orders_ozon_order_id_idx").on(table.ozon_order_id),
    index("orders_shop_id_idx").on(table.shop_id),
    index("orders_status_idx").on(table.status),
    index("orders_created_at_idx").on(table.created_at),
    index("orders_status_created_idx").on(table.status, table.created_at),
  ]
);

// 订单商品明细表
export const orderItems = pgTable(
  "order_items",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    order_id: varchar("order_id", { length: 36 }).notNull().references(() => orders.id, { onDelete: "cascade" }),
    
    // 商品信息
    sku: varchar("sku", { length: 128 }).notNull(),
    name: varchar("name", { length: 256 }).notNull(),
    quantity: integer("quantity").notNull().default(1),
    price: numeric("price", { precision: 12, scale: 2 }).notNull().default("0"),
    
    // Ozon商品ID
    ozon_offer_id: varchar("ozon_offer_id", { length: 128 }),
    ozon_product_id: integer("ozon_product_id"),
    
    // 货源映射
    source_type: varchar("source_type", { length: 20 }), // '1688' | 'pdd' | null
    source_url: text("source_url"),
    source_price: numeric("source_price", { precision: 12, scale: 2 }),
    
    // 验货状态
    inspected_quantity: integer("inspected_quantity").default(0),
    is_inspected: boolean("is_inspected").default(false).notNull(),
    
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("order_items_order_id_idx").on(table.order_id),
    index("order_items_sku_idx").on(table.sku),
  ]
);

// 订单同步日志表
export const orderSyncLogs = pgTable(
  "order_sync_logs",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    shop_id: varchar("shop_id", { length: 36 }).notNull().references(() => shops.id),
    
    sync_type: varchar("sync_type", { length: 20 }).notNull(), // 'auto' | 'manual'
    status: varchar("status", { length: 20 }).notNull(), // 'success' | 'failed' | 'partial'
    
    orders_fetched: integer("orders_fetched").default(0),
    orders_created: integer("orders_created").default(0),
    orders_updated: integer("orders_updated").default(0),
    
    error_message: text("error_message"),
    
    started_at: timestamp("started_at", { withTimezone: true }).notNull(),
    finished_at: timestamp("finished_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("order_sync_logs_shop_id_idx").on(table.shop_id),
    index("order_sync_logs_created_at_idx").on(table.created_at),
  ]
);

// 类型导出
export type Shop = typeof shops.$inferSelect;
export type InsertShop = typeof shops.$inferInsert;
export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;
export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = typeof orderItems.$inferInsert;
export type OrderSyncLog = typeof orderSyncLogs.$inferSelect;
export type InsertOrderSyncLog = typeof orderSyncLogs.$inferInsert;
