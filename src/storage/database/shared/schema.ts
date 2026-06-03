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

// SKU主数据表
export const skus = pgTable(
  "skus",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    
    // SKU基本信息
    sku_code: varchar("sku_code", { length: 128 }).notNull().unique(),
    name: varchar("name", { length: 256 }).notNull(),
    description: text("description"),
    category: varchar("category", { length: 64 }),
    image_url: text("image_url"),
    
    // Ozon商品映射
    ozon_offer_id: varchar("ozon_offer_id", { length: 128 }),
    ozon_product_id: integer("ozon_product_id"),
    
    // 货源信息（支持多货源）
    default_source_type: varchar("default_source_type", { length: 20 }), // '1688' | 'pdd'
    default_source_url: text("default_source_url"),
    default_source_price: numeric("default_source_price", { precision: 12, scale: 2 }),
    
    // 成本与定价
    cost_price: numeric("cost_price", { precision: 12, scale: 2 }),
    selling_price: numeric("selling_price", { precision: 12, scale: 2 }),
    
    // 库存配置
    safety_stock: integer("safety_stock").default(0), // 安全库存
    is_stocked: boolean("is_stocked").default(false).notNull(), // 是否备货
    
    // 状态
    is_active: boolean("is_active").default(true).notNull(),
    
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("skus_sku_code_idx").on(table.sku_code),
    index("skus_ozon_offer_id_idx").on(table.ozon_offer_id),
    index("skus_category_idx").on(table.category),
  ]
);

// 供应商表
export const suppliers = pgTable(
  "suppliers",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    
    // 供应商基本信息
    name: varchar("name", { length: 128 }).notNull(),
    contact_name: varchar("contact_name", { length: 64 }),
    contact_phone: varchar("contact_phone", { length: 32 }),
    contact_wechat: varchar("contact_wechat", { length: 64 }),
    
    // 平台信息
    platform: varchar("platform", { length: 20 }).notNull(), // '1688' | 'pdd' | 'taobao'
    shop_url: text("shop_url"),
    shop_name: varchar("shop_name", { length: 128 }),
    
    // 评级
    rating: numeric("rating", { precision: 2, scale: 1 }).default("3.0"),
    
    // 状态
    is_active: boolean("is_active").default(true).notNull(),
    
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("suppliers_platform_idx").on(table.platform),
    index("suppliers_name_idx").on(table.name),
  ]
);

// SKU货源映射表（多对多）
export const skuSources = pgTable(
  "sku_sources",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    sku_id: varchar("sku_id", { length: 36 }).notNull().references(() => skus.id, { onDelete: "cascade" }),
    supplier_id: varchar("supplier_id", { length: 36 }).notNull().references(() => suppliers.id, { onDelete: "cascade" }),
    
    source_url: text("source_url").notNull(),
    source_price: numeric("source_price", { precision: 12, scale: 2 }),
    is_preferred: boolean("is_preferred").default(false).notNull(), // 是否首选货源
    
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("sku_sources_sku_id_idx").on(table.sku_id),
    index("sku_sources_supplier_id_idx").on(table.supplier_id),
  ]
);

// 采购任务表
export const purchaseTasks = pgTable(
  "purchase_tasks",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    order_id: varchar("order_id", { length: 36 }).notNull().references(() => orders.id, { onDelete: "cascade" }),
    order_item_id: varchar("order_item_id", { length: 36 }).notNull().references(() => orderItems.id, { onDelete: "cascade" }),
    
    // 采购状态
    status: varchar("status", { length: 32 }).notNull().default("pending"), // pending | purchased | received | cancelled
    // pending: 待采购
    // purchased: 已下单（人工在外部平台下单）
    // received: 已收货（绑定完成）
    // cancelled: 已取消
    
    // 采购信息
    sku_id: varchar("sku_id", { length: 36 }).references(() => skus.id),
    sku_code: varchar("sku_code", { length: 128 }).notNull(),
    quantity: integer("quantity").notNull().default(1),
    
    // 货源信息
    source_type: varchar("source_type", { length: 20 }), // '1688' | 'pdd'
    source_url: text("source_url"),
    source_price: numeric("source_price", { precision: 12, scale: 2 }),
    
    // 采购金额
    purchase_amount: numeric("purchase_amount", { precision: 12, scale: 2 }),
    shipping_fee: numeric("shipping_fee", { precision: 12, scale: 2 }).default("0"),
    
    // 绑定信息（人机协同）
    is_bound: boolean("is_bound").default(false).notNull(),
    domestic_tracking_number: varchar("domestic_tracking_number", { length: 64 }),
    bound_at: timestamp("bound_at", { withTimezone: true }),
    bound_by: varchar("bound_by", { length: 36 }), // 操作人账号ID
    
    // 时间戳
    purchased_at: timestamp("purchased_at", { withTimezone: true }),
    received_at: timestamp("received_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("purchase_tasks_order_id_idx").on(table.order_id),
    index("purchase_tasks_status_idx").on(table.status),
    index("purchase_tasks_sku_code_idx").on(table.sku_code),
    index("purchase_tasks_domestic_tracking_idx").on(table.domestic_tracking_number),
  ]
);

// 仓库表
export const warehouses = pgTable(
  "warehouses",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    name: varchar("name", { length: 64 }).notNull(),
    code: varchar("code", { length: 32 }).notNull().unique(),
    address: text("address"),
    is_default: boolean("is_default").default(false).notNull(),
    is_active: boolean("is_active").default(true).notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  }
);

// 库位表
export const warehouseLocations = pgTable(
  "warehouse_locations",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    warehouse_id: varchar("warehouse_id", { length: 36 }).notNull().references(() => warehouses.id, { onDelete: "cascade" }),
    
    code: varchar("code", { length: 32 }).notNull(), // 库位编码 如 A-01-01
    zone: varchar("zone", { length: 16 }), // 区域 A/B/C
    row: integer("row"), // 行号
    column: integer("column"), // 列号
    
    is_active: boolean("is_active").default(true).notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("warehouse_locations_warehouse_id_idx").on(table.warehouse_id),
  ]
);

// 库存表
export const inventory = pgTable(
  "inventory",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    sku_id: varchar("sku_id", { length: 36 }).notNull().references(() => skus.id, { onDelete: "cascade" }),
    warehouse_id: varchar("warehouse_id", { length: 36 }).notNull().references(() => warehouses.id, { onDelete: "cascade" }),
    location_id: varchar("location_id", { length: 36 }).references(() => warehouseLocations.id),
    
    quantity: integer("quantity").notNull().default(0), // 在库数量
    reserved_quantity: integer("reserved_quantity").notNull().default(0), // 预留数量
    
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("inventory_sku_id_idx").on(table.sku_id),
    index("inventory_warehouse_id_idx").on(table.warehouse_id),
  ]
);

// 库存流水表
export const inventoryLogs = pgTable(
  "inventory_logs",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    sku_id: varchar("sku_id", { length: 36 }).notNull(),
    warehouse_id: varchar("warehouse_id", { length: 36 }).notNull(),
    
    type: varchar("type", { length: 20 }).notNull(), // 'in' | 'out' | 'adjust'
    quantity: integer("quantity").notNull(), // 变动数量（正数为入，负数为出）
    before_quantity: integer("before_quantity").notNull(),
    after_quantity: integer("after_quantity").notNull(),
    
    ref_type: varchar("ref_type", { length: 32 }), // 'purchase' | 'order' | 'adjust'
    ref_id: varchar("ref_id", { length: 36 }),
    
    remark: text("remark"),
    
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("inventory_logs_sku_id_idx").on(table.sku_id),
    index("inventory_logs_created_at_idx").on(table.created_at),
  ]
);

// 验货记录表
export const inspectionRecords = pgTable(
  "inspection_records",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    order_id: varchar("order_id", { length: 36 }).notNull().references(() => orders.id, { onDelete: "cascade" }),
    purchase_task_id: varchar("purchase_task_id", { length: 36 }).references(() => purchaseTasks.id),
    
    // 扫描信息（扫描枪集成）
    scanned_tracking_number: varchar("scanned_tracking_number", { length: 64 }),
    scan_time: timestamp("scan_time", { withTimezone: true }),
    
    // 验货结果
    result: varchar("result", { length: 20 }).notNull(), // 'pass' | 'fail' | 'partial'
    inspected_quantity: integer("inspected_quantity").default(0),
    failed_quantity: integer("failed_quantity").default(0),
    
    // 异常信息
    has_issue: boolean("has_issue").default(false).notNull(),
    issue_type: varchar("issue_type", { length: 32 }), // 'wrong_item' | 'damaged' | 'quantity_mismatch' | 'other'
    issue_description: text("issue_description"),
    
    // 是否生成售后工单
    has_after_sale_ticket: boolean("has_after_sale_ticket").default(false).notNull(),
    after_sale_ticket_id: varchar("after_sale_ticket_id", { length: 36 }),
    
    inspected_by: varchar("inspected_by", { length: 36 }),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("inspection_records_order_id_idx").on(table.order_id),
    index("inspection_records_scanned_tracking_idx").on(table.scanned_tracking_number),
  ]
);

// 打包记录表
export const packagingRecords = pgTable(
  "packaging_records",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    order_id: varchar("order_id", { length: 36 }).notNull().references(() => orders.id, { onDelete: "cascade" }),
    
    // 称重信息（电子秤集成）
    weight: numeric("weight", { precision: 8, scale: 3 }), // kg
    weigh_time: timestamp("weigh_time", { withTimezone: true }),
    
    // 面单信息
    label_printed: boolean("label_printed").default(false).notNull(),
    label_printed_at: timestamp("label_printed_at", { withTimezone: true }),
    
    // 包材
    package_type: varchar("package_type", { length: 32 }),
    package_cost: numeric("package_cost", { precision: 8, scale: 2 }).default("0"),
    
    packed_by: varchar("packed_by", { length: 36 }),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("packaging_records_order_id_idx").on(table.order_id),
  ]
);

// 财务记录表
export const financeRecords = pgTable(
  "finance_records",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    order_id: varchar("order_id", { length: 36 }).notNull().references(() => orders.id, { onDelete: "cascade" }),
    
    // 收入
    ozon_settlement_amount: numeric("ozon_settlement_amount", { precision: 12, scale: 2 }), // Ozon结算金额
    settlement_at: timestamp("settlement_at", { withTimezone: true }),
    
    // 成本
    purchase_cost: numeric("purchase_cost", { precision: 12, scale: 2 }).default("0"), // 采购成本
    domestic_shipping_cost: numeric("domestic_shipping_cost", { precision: 12, scale: 2 }).default("0"), // 国内运费
    package_cost: numeric("package_cost", { precision: 12, scale: 2 }).default("0"), // 包材费
    ozon_commission: numeric("ozon_commission", { precision: 12, scale: 2 }).default("0"), // Ozon佣金
    other_cost: numeric("other_cost", { precision: 12, scale: 2 }).default("0"), // 其他成本
    
    // 售后损失
    after_sale_loss: numeric("after_sale_loss", { precision: 12, scale: 2 }).default("0"),
    
    // 利润
    gross_profit: numeric("gross_profit", { precision: 12, scale: 2 }).default("0"), // 毛利
    net_profit: numeric("net_profit", { precision: 12, scale: 2 }).default("0"), // 净利（扣除售后）
    
    // 核算状态
    is_settled: boolean("is_settled").default(false).notNull(), // 是否已核算
    settled_at: timestamp("settled_at", { withTimezone: true }),
    
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("finance_records_order_id_idx").on(table.order_id),
    index("finance_records_settled_at_idx").on(table.settled_at),
  ]
);

// 角色表
export const roles = pgTable(
  "roles",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    name: varchar("name", { length: 32 }).notNull(),
    code: varchar("code", { length: 32 }).notNull().unique(),
    description: text("description"),
    
    // 权限级别
    level: integer("level").default(0), // 0: 超管, 1: 管理员, 2: 运营, 3: 仓库
    
    // 权限配置（JSON）
    permissions: jsonb("permissions"),
    
    is_system: boolean("is_system").default(false).notNull(), // 是否系统内置角色
    is_active: boolean("is_active").default(true).notNull(),
    
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  }
);

// 账号表
export const accounts = pgTable(
  "accounts",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    
    // 登录信息
    phone: varchar("phone", { length: 20 }).notNull().unique(),
    name: varchar("name", { length: 64 }),
    avatar_url: text("avatar_url"),
    
    // 角色关联
    role_id: varchar("role_id", { length: 36 }).references(() => roles.id),
    
    // 状态
    is_active: boolean("is_active").default(true).notNull(),
    last_login_at: timestamp("last_login_at", { withTimezone: true }),
    
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("accounts_phone_idx").on(table.phone),
    index("accounts_role_id_idx").on(table.role_id),
  ]
);

// 操作日志表
export const operationLogs = pgTable(
  "operation_logs",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    
    account_id: varchar("account_id", { length: 36 }),
    action: varchar("action", { length: 64 }).notNull(),
    module: varchar("module", { length: 32 }).notNull(),
    
    ref_type: varchar("ref_type", { length: 32 }),
    ref_id: varchar("ref_id", { length: 36 }),
    
    detail: jsonb("detail"),
    ip_address: varchar("ip_address", { length: 45 }),
    
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("operation_logs_account_id_idx").on(table.account_id),
    index("operation_logs_created_at_idx").on(table.created_at),
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

export type Sku = typeof skus.$inferSelect;
export type InsertSku = typeof skus.$inferInsert;
export type Supplier = typeof suppliers.$inferSelect;
export type InsertSupplier = typeof suppliers.$inferInsert;
export type SkuSource = typeof skuSources.$inferSelect;
export type InsertSkuSource = typeof skuSources.$inferInsert;
export type PurchaseTask = typeof purchaseTasks.$inferSelect;
export type InsertPurchaseTask = typeof purchaseTasks.$inferInsert;
export type Warehouse = typeof warehouses.$inferSelect;
export type InsertWarehouse = typeof warehouses.$inferInsert;
export type WarehouseLocation = typeof warehouseLocations.$inferSelect;
export type InsertWarehouseLocation = typeof warehouseLocations.$inferInsert;
export type Inventory = typeof inventory.$inferSelect;
export type InsertInventory = typeof inventory.$inferInsert;
export type InventoryLog = typeof inventoryLogs.$inferSelect;
export type InsertInventoryLog = typeof inventoryLogs.$inferInsert;
export type InspectionRecord = typeof inspectionRecords.$inferSelect;
export type InsertInspectionRecord = typeof inspectionRecords.$inferInsert;
export type PackagingRecord = typeof packagingRecords.$inferSelect;
export type InsertPackagingRecord = typeof packagingRecords.$inferInsert;
export type FinanceRecord = typeof financeRecords.$inferSelect;
export type InsertFinanceRecord = typeof financeRecords.$inferInsert;
export type Role = typeof roles.$inferSelect;
export type InsertRole = typeof roles.$inferInsert;
export type Account = typeof accounts.$inferSelect;
export type InsertAccount = typeof accounts.$inferInsert;
export type OperationLog = typeof operationLogs.$inferSelect;
export type InsertOperationLog = typeof operationLogs.$inferInsert;
