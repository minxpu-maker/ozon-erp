import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer, numeric, jsonb, index, serial, uuid, bigint, decimal, date, uniqueIndex } from "drizzle-orm/pg-core";

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
    // Ozon API 凭证（兼容字段）
    ozon_client_id: varchar("ozon_client_id", { length: 64 }),
    ozon_api_key: varchar("ozon_api_key", { length: 128 }),
    is_primary: boolean("is_primary").default(false).notNull(),
    is_active: boolean("is_active").default(true).notNull(),
    last_sync_at: timestamp("last_sync_at", { withTimezone: true }),
    // AI选品模块新增字段
    seller_type: varchar("seller_type", { length: 20 }).default('cn_crossborder'), // cn_crossborder / ru_local
    current_stage: varchar("current_stage", { length: 20 }).default('new'), // new / growing / mature
    selection_mode: varchar("selection_mode", { length: 20 }).default('follow'), // follow / refine
    price_range_min: integer("price_range_min").default(200),
    price_range_max: integer("price_range_max").default(1500),
    api_rate_limit_remaining: integer("api_rate_limit_remaining"), // 剩余API调用次数
    api_rate_limit_reset_at: timestamp("api_rate_limit_reset_at", { withTimezone: true }), // 频率限制重置时间
    default_logistics_template_id: integer("default_logistics_template_id"), // 店铺默认物流模板ID
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
    
    // 采购价格（人民币）
    purchase_price: numeric("purchase_price", { precision: 12, scale: 2 }).default("0"),
    
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

// 系统配置表 - 存储汇率等系统设置
export const systemConfigs = pgTable("system_configs", {
  key: varchar("key", { length: 64 }).primaryKey(),
  value: text("value").notNull(),
  description: varchar("description", { length: 256 }),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type SystemConfig = typeof systemConfigs.$inferSelect;
// 商品信息缓存表（来自Ozon商品库）
export const ozonProducts = pgTable('ozon_products', {
  id: uuid('id').defaultRandom().primaryKey(),
  shop_id: uuid('shop_id').notNull().references(() => shops.id),
  
  // Ozon商品信息
  ozon_product_id: bigint('ozon_product_id', { mode: 'number' }).notNull(),
  offer_id: varchar('offer_id', { length: 128 }).notNull(),
  name: varchar('name', { length: 512 }).notNull(),
  description: text('description'),
  
  // 图片信息
  main_image: text('main_image'), // 主图URL
  images: jsonb('images').$type<string[]>().default([]), // 所有图片URL数组
  
  // 商品属性（颜色、尺寸等）
  attributes: jsonb('attributes').$type<Array<{ name: string; value: string }>>().default([]),
  
  // 价格信息
  price: varchar('price', { length: 32 }),
  old_price: varchar('old_price', { length: 32 }),
  marketing_price: varchar('marketing_price', { length: 32 }),
  
  // 库存信息
  stock: integer('stock').default(0),
  reserved: integer('reserved').default(0),
  
  // 商品状态
  status: varchar('status', { length: 32 }).default('active'),
  is_visible: boolean('is_visible').default(true),
  
  // 条形码
  barcode: varchar('barcode', { length: 64 }),
  
  // 规格尺寸
  weight: varchar('weight', { length: 32 }),
  height: varchar('height', { length: 32 }),
  width: varchar('width', { length: 32 }),
  depth: varchar('depth', { length: 32 }),
  
  // 原始数据
  raw_data: jsonb('raw_data').$type<Record<string, unknown>>(),
  
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type OzonProduct = typeof ozonProducts.$inferSelect;
export type InsertOzonProduct = typeof ozonProducts.$inferInsert;

export type InsertSystemConfig = typeof systemConfigs.$inferInsert;
export type OperationLog = typeof operationLogs.$inferSelect;
export type InsertOperationLog = typeof operationLogs.$inferInsert;

// ============================================================================
// AI智能选品模块 Schema
// 技术栈: Next.js 16 + React 19 + TypeScript 5 + Drizzle ORM 0.45 + PostgreSQL
//
// 说明:
// - embedding 字段使用 jsonb 类型（一期不使用 pgvector 扩展）
// - 所有引用 shops.id 的外键使用 varchar(36) UUID 类型（与主 schema 保持一致）
// ============================================================================

// ============================================================================
// 一、EAC认证配置表
// ============================================================================

/**
 * EAC认证配置表 — 一键切换能力（EAC策略的唯一数据源）
 * D-014: 俄本土卖家一票否决，中国卖家风险提示（预留一键切换）
 */
export const eacConfig = pgTable('eac_config', {
  id: serial('id').primaryKey(),
  sellerType: varchar('seller_type', { length: 20 }).notNull(), // cn_crossborder / ru_local
  policy: varchar('policy', { length: 10 }).notNull(),          // warning / veto
  updatedAt: timestamp('updated_at').defaultNow(),
  updatedBy: varchar('updated_by', { length: 50 }),
}, (table) => [
  uniqueIndex('idx_eac_config_seller_type').on(table.sellerType),
]);

// ============================================================================
// 二、核心业务对象
// ============================================================================

/**
 * 选品单 (Opportunity) — 记录一个选品机会
 */
export const opportunities = pgTable('opportunities', {
  id: serial('id').primaryKey(),
  shopId: varchar('shop_id', { length: 36 }).references(() => shops.id, { onDelete: 'cascade' }).notNull(),

  // 选品来源
  source: varchar('source', { length: 20 }).notNull(),
  selectionMode: varchar('selection_mode', { length: 20 }).notNull(),

  // 选品目标
  targetType: varchar('target_type', { length: 20 }).notNull(),
  targetCategoryId: integer('target_category_id'),
  targetProductId: integer('target_product_id'),
  targetName: varchar('target_name', { length: 500 }),

  // 市场分析概要
  marketAnalysis: jsonb('market_analysis'),
  profitEstimate: jsonb('profit_estimate'),
  riskFlags: jsonb('risk_flags'),

  // 状态
  status: varchar('status', { length: 20 }).default('discovered'),
  confirmedAt: timestamp('confirmed_at'),
  abandonedReason: text('abandoned_reason'),

  // 归属与转化关联
  assignedTo: varchar('assigned_to', { length: 50 }),
  parentOpportunityId: integer('parent_opportunity_id'),

  // 元数据
  dataSources: jsonb('data_sources'),
  strategyTemplateId: integer('strategy_template_id'),
  notes: text('notes'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  index('idx_opportunities_shop_id').on(table.shopId),
  index('idx_opportunities_status').on(table.status),
  index('idx_opportunities_category').on(table.targetCategoryId),
]);

/**
 * 商品卡 (Product Card) — 准备上架的商品完整信息（SPU级）
 */
export const productCards = pgTable('product_cards', {
  id: serial('id').primaryKey(),
  shopId: varchar('shop_id', { length: 36 }).references(() => shops.id, { onDelete: 'cascade' }).notNull(),
  opportunityId: integer('opportunity_id').references(() => opportunities.id),

  // Ozon类目信息
  ozonCategoryId: integer('ozon_category_id').notNull(),
  ozonCategoryName: varchar('ozon_category_name', { length: 500 }),

  // 商品信息
  titleRu: varchar('title_ru', { length: 500 }),
  titleZh: varchar('title_zh', { length: 500 }),
  description: text('description_ru'),
  attributes: jsonb('attributes'),
  variantAttributes: jsonb('variant_attributes'),

  // 定价
  suggestedPrice: integer('suggested_price'),
  costPrice: integer('cost_price'),
  commissionRate: decimal('commission_rate', { precision: 5, scale: 2 }),

  // 状态
  status: varchar('status', { length: 20 }).default('draft'),
  isEacRequired: boolean('is_eac_required').default(false),
  eacStatus: varchar('eac_status', { length: 20 }).default('none'),

  // 来源
  source1688Url: text('source_1688_url'),
  sourceOzonUrl: text('source_ozon_url'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  index('idx_product_cards_shop_id').on(table.shopId),
  index('idx_product_cards_status').on(table.status),
  index('idx_product_cards_category').on(table.ozonCategoryId),
]);

/**
 * 商品变体/SKU表
 */
export const productVariants = pgTable('product_variants', {
  id: serial('id').primaryKey(),
  productCardId: integer('product_card_id').references(() => productCards.id, { onDelete: 'cascade' }).notNull(),

  variantName: varchar('variant_name', { length: 200 }),
  variantValues: jsonb('variant_values').notNull(),
  ozonVariantId: varchar('ozon_variant_id', { length: 50 }),

  confirmedPrice: integer('confirmed_price'),
  costPrice: integer('cost_price'),
  stock: integer('stock').default(0),

  primaryImageSetId: integer('primary_image_set_id'),
  status: varchar('status', { length: 20 }).default('draft'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  index('idx_product_variants_product_card_id').on(table.productCardId),
]);

/**
 * 图片集 (Image Set)
 */
export const imageSets = pgTable('image_sets', {
  id: serial('id').primaryKey(),
  productCardId: integer('product_card_id').references(() => productCards.id, { onDelete: 'cascade' }).notNull(),
  variantId: integer('variant_id').references(() => productVariants.id),

  originalImages: jsonb('original_images').notNull(),
  processedImages: jsonb('processed_images'),
  primaryImageIndex: integer('primary_image_index').default(0),

  templateId: integer('template_id').references(() => imageTemplates.id),
  aiEditProvider: varchar('ai_edit_provider', { length: 50 }),
  aiEditParams: jsonb('ai_edit_params'),
  complianceChecks: jsonb('compliance_checks'),

  status: varchar('status', { length: 20 }).default('created'),
  reviewerId: varchar('reviewer_id', { length: 50 }),
  reviewedAt: timestamp('reviewed_at'),
  rejectReason: text('reject_reason'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  index('idx_image_sets_product_card_id').on(table.productCardId),
]);

/**
 * 上架任务 (Listing Task)
 */
export const listingTasks = pgTable('listing_tasks', {
  id: serial('id').primaryKey(),
  productCardId: integer('product_card_id').references(() => productCards.id, { onDelete: 'cascade' }).notNull(),
  shopId: varchar('shop_id', { length: 36 }).references(() => shops.id, { onDelete: 'cascade' }).notNull(),
  variantId: integer('variant_id').references(() => productVariants.id),

  ozonTaskId: integer('ozon_task_id'),
  ozonProductId: varchar('ozon_product_id', { length: 50 }),

  status: varchar('status', { length: 20 }).default('created'),

  logisticsTemplateId: integer('logistics_template_id'),
  packageWeight: decimal('package_weight', { precision: 8, scale: 2 }),
  packageDimensions: jsonb('package_dimensions'),

  resultMessage: text('result_message'),
  lastPollAt: timestamp('last_poll_at'),
  failureReason: text('failure_reason'),
  retryCount: integer('retry_count').default(0),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  index('idx_listing_tasks_product_card_id').on(table.productCardId),
  index('idx_listing_tasks_shop_id').on(table.shopId),
  index('idx_listing_tasks_status').on(table.status),
]);

/**
 * 修图模板表
 */
export const imageTemplates = pgTable('image_templates', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 200 }).notNull(),
  type: varchar('type', { length: 30 }).notNull(),

  config: jsonb('config').notNull(),
  ozonSpec: jsonb('ozon_spec'),
  previewImageKey: varchar('preview_image_key', { length: 500 }),
  applicableCategoryIds: jsonb('applicable_category_ids'),

  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  index('idx_image_templates_type').on(table.type),
]);

/**
 * 选品策略模板表
 */
export const selectionStrategyTemplates = pgTable('selection_strategy_templates', {
  id: serial('id').primaryKey(),
  shopId: varchar('shop_id', { length: 36 }).references(() => shops.id),
  name: varchar('name', { length: 200 }).notNull(),
  selectionMode: varchar('selection_mode', { length: 20 }).notNull(),

  ahpConfig: jsonb('ahp_config'),
  hardConstraints: jsonb('hard_constraints'),
  priceRangeMin: integer('price_range_min'),
  priceRangeMax: integer('price_range_max'),

  isDefault: boolean('is_default').default(false),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  index('idx_strategy_templates_shop_mode').on(table.shopId, table.selectionMode),
]);

// ============================================================================
// 三、选品算法相关表
// ============================================================================

/**
 * 综合评分结果表
 */
export const productScores = pgTable('product_scores', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').references(() => productCards.id, { onDelete: 'cascade' }).notNull(),
  shopId: varchar('shop_id', { length: 36 }).references(() => shops.id).notNull(),
  opportunityId: integer('opportunity_id').references(() => opportunities.id),

  shopStage: varchar('shop_stage', { length: 20 }),
  sellerType: varchar('seller_type', { length: 20 }),
  selectionMode: varchar('selection_mode', { length: 20 }),

  hardConstraintDiscount: decimal('hard_constraint_discount', { precision: 3, scale: 2 }).default('1.00'),
  hardConstraintDetails: jsonb('hard_constraint_details'),

  ahpWeights: jsonb('ahp_weights'),
  entropyWeights: jsonb('entropy_weights'),
  combinedWeights: jsonb('combined_weights'),

  topsisScore: decimal('topsis_score', { precision: 5, scale: 4 }),
  demandScore: decimal('demand_score', { precision: 5, scale: 4 }),
  competitionScore: decimal('competition_score', { precision: 5, scale: 4 }),
  profitScore: decimal('profit_score', { precision: 5, scale: 4 }),
  supplyScore: decimal('supply_score', { precision: 5, scale: 4 }),
  riskScore: decimal('risk_score', { precision: 5, scale: 4 }),
  semanticScore: decimal('semantic_score', { precision: 5, scale: 4 }),

  predictedSales7d: integer('predicted_sales_7d'),
  predictedSales30d: integer('predicted_sales_30d'),
  trendDirection: varchar('trend_direction', { length: 10 }),
  trendChangepoints: jsonb('trend_changepoints'),

  opportunityIndex: decimal('opportunity_index', { precision: 5, scale: 4 }),
  crossVerifyDiscount: decimal('cross_verify_discount', { precision: 3, scale: 2 }).default('1.00'),
  crossVerifyResult: jsonb('cross_verify_result'),

  compositeScore: decimal('composite_score', { precision: 5, scale: 4 }),
  grade: varchar('grade', { length: 1 }),

  followSignal: varchar('follow_signal', { length: 20 }),
  sellerCountOnShelf: integer('seller_count_on_shelf'),
  differentiationScore: decimal('differentiation_score', { precision: 5, scale: 4 }),
  negativeReviewKeywords: jsonb('negative_review_keywords'),
  eacRiskLevel: varchar('eac_risk_level', { length: 10 }),
  llmInsight: jsonb('llm_insight'),

  calculatedAt: timestamp('calculated_at').defaultNow(),
  expiresAt: timestamp('expires_at'),
}, (table) => [
  index('idx_product_scores_product_id').on(table.productId),
  index('idx_product_scores_shop_id').on(table.shopId),
  index('idx_product_scores_grade').on(table.grade),
]);

/**
 * AHP权重配置表
 */
export const ahpWeights = pgTable('ahp_weights', {
  id: serial('id').primaryKey(),
  categoryId: integer('category_id'),
  categoryName: varchar('category_name', { length: 200 }),
  selectionMode: varchar('selection_mode', { length: 20 }).notNull(),

  judgmentMatrix: jsonb('judgment_matrix').notNull(),
  weightVector: jsonb('weight_vector').notNull(),
  consistencyRatio: decimal('consistency_ratio', { precision: 5, scale: 4 }),

  entropyWeights: jsonb('entropy_weights'),
  combinedWeights: jsonb('combined_weights'),
  alpha: decimal('alpha', { precision: 3, scale: 2 }).default('0.50'),
  strategy: varchar('strategy', { length: 30 }),

  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  uniqueIndex('idx_ahp_weights_category_mode').on(table.categoryId, table.selectionMode, table.strategy),
]);

/**
 * 产品Embedding表 — 使用 jsonb 存储
 */
export const productEmbeddings = pgTable('product_embeddings', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').references(() => productCards.id, { onDelete: 'cascade' }).notNull(),
  embedding: jsonb('embedding'),
  embeddingSource: varchar('embedding_source', { length: 50 }),
  model: varchar('model', { length: 50 }).default('text-embedding-3-small'),
  textHash: varchar('text_hash', { length: 64 }),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index('idx_product_embeddings_product_id').on(table.productId),
]);

/**
 * Prophet预测缓存表
 */
export const prophetForecasts = pgTable('prophet_forecasts', {
  id: serial('id').primaryKey(),
  targetType: varchar('target_type', { length: 10 }).notNull(),
  targetId: integer('target_id').notNull(),
  targetName: varchar('target_name', { length: 200 }),

  forecastDate: date('forecast_date').notNull(),
  predictedValue: decimal('predicted_value', { precision: 10, scale: 2 }),
  lowerBound: decimal('lower_bound', { precision: 10, scale: 2 }),
  upperBound: decimal('upper_bound', { precision: 10, scale: 2 }),
  trendDirection: varchar('trend_direction', { length: 10 }),

  changepoints: jsonb('changepoints'),
  holidays: jsonb('holidays'),
  modelParams: jsonb('model_params'),

  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index('idx_prophet_target').on(table.targetType, table.targetId),
  index('idx_prophet_date').on(table.forecastDate),
]);

/**
 * 数据源健康状态表
 */
export const dataSourceHealth = pgTable('data_source_health', {
  id: serial('id').primaryKey(),
  source: varchar('source', { length: 30 }).notNull(),
  status: varchar('status', { length: 20 }).notNull(),
  lastCheckAt: timestamp('last_check_at').notNull(),
  lastSuccessAt: timestamp('last_success_at'),
  responseTime: integer('response_time'),
  errorRate: decimal('error_rate', { precision: 5, scale: 2 }),
  errorMessage: text('error_message'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  uniqueIndex('idx_data_source_health_source').on(table.source),
]);

/**
 * 选品复盘追踪表
 */
export const selectionRetrospectives = pgTable('selection_retrospectives', {
  id: serial('id').primaryKey(),
  shopId: varchar('shop_id', { length: 36 }).references(() => shops.id).notNull(),
  opportunityId: integer('opportunity_id').references(() => opportunities.id),
  productCardId: integer('product_card_id').references(() => productCards.id),

  selectedAt: timestamp('selected_at'),
  listedAt: timestamp('listed_at'),
  firstOrderAt: timestamp('first_order_at'),

  actualSales7d: integer('actual_sales_7d'),
  actualSales30d: integer('actual_sales_30d'),
  predictedSales7d: integer('predicted_sales_7d'),
  predictedSales30d: integer('predicted_sales_30d'),

  accuracyScore: decimal('accuracy_score', { precision: 5, scale: 2 }),
  actualMargin: decimal('actual_margin', { precision: 5, scale: 2 }),

  grade: varchar('grade', { length: 1 }),
  actualPerformance: varchar('actual_performance', { length: 20 }),

  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index('idx_retrospectives_shop_id').on(table.shopId),
  index('idx_retrospectives_grade').on(table.grade),
]);

/**
 * 通知表
 */
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id', { length: 50 }).notNull(),
  type: varchar('type', { length: 30 }).notNull(),
  severity: varchar('severity', { length: 10 }).notNull(),

  title: varchar('title', { length: 200 }).notNull(),
  body: text('body'),

  relatedEntityType: varchar('related_entity_type', { length: 30 }),
  relatedEntityId: integer('related_entity_id'),

  isRead: boolean('is_read').default(false),
  readAt: timestamp('read_at'),

  actionType: varchar('action_type', { length: 30 }),
  actionData: jsonb('action_data'),
  actionCompletedAt: timestamp('action_completed_at'),

  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index('idx_notifications_user_id').on(table.userId),
  index('idx_notifications_is_read').on(table.isRead),
]);

/**
 * Ozon平台知识缓存表
 */
export const ozonKnowledgeCache = pgTable('ozon_knowledge_cache', {
  id: serial('id').primaryKey(),
  domain: varchar('domain', { length: 50 }).notNull(),
  categoryId: integer('category_id'),
  data: jsonb('data').notNull(),
  dataHash: varchar('data_hash', { length: 64 }).notNull(),
  syncedAt: timestamp('synced_at').defaultNow(),
  syncSource: varchar('sync_source', { length: 50 }),
  apiEndpoint: varchar('api_endpoint', { length: 200 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  uniqueIndex('idx_knowledge_domain_category').on(table.domain, table.categoryId),
]);

/**
 * 政策变更事件表
 */
export const policyChangeEvents = pgTable('policy_change_events', {
  id: serial('id').primaryKey(),
  domain: varchar('domain', { length: 50 }).notNull(),
  severity: varchar('severity', { length: 10 }).notNull(),
  changeSummary: text('change_summary').notNull(),
  beforeData: jsonb('before_data'),
  afterData: jsonb('after_data'),
  affectedCategories: jsonb('affected_categories'),
  affectedProducts: jsonb('affected_products'),
  algorithmImpact: jsonb('algorithm_impact'),
  suggestedAction: text('suggested_action'),
  effectiveDate: timestamp('effective_date'),
  notifiedAt: timestamp('notified_at'),
  acknowledgedAt: timestamp('acknowledged_at'),
  acknowledgedBy: varchar('acknowledged_by', { length: 50 }),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index('idx_policy_change_severity').on(table.severity),
  index('idx_policy_change_domain').on(table.domain),
]);

/**
 * 同步调度配置表
 */
export const syncSchedules = pgTable('sync_schedules', {
  id: serial('id').primaryKey(),
  domain: varchar('domain', { length: 50 }).notNull(),
  apiEndpoint: varchar('api_endpoint', { length: 200 }),
  cronExpression: varchar('cron_expression', { length: 50 }),
  frequency: varchar('frequency', { length: 20 }),
  isActive: boolean('is_active').default(true),
  lastSyncAt: timestamp('last_sync_at'),
  lastSyncStatus: varchar('last_sync_status', { length: 20 }),
  lastError: text('last_error'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  uniqueIndex('idx_sync_schedules_domain').on(table.domain),
]);

/**
 * 市场信号表 - Chrome插件采集的Ozon商品数据
 */
export const marketSignals = pgTable('market_signals', {
  id: serial('id').primaryKey(),
  shopId: varchar('shop_id', { length: 36 }).notNull().references(() => shops.id),
  
  // 商品基本信息
  ozonProductId: varchar('ozon_product_id', { length: 50 }).notNull(),
  productTitle: varchar('product_title', { length: 500 }).notNull(),
  productTitleZh: varchar('product_title_zh', { length: 500 }), // 中文翻译标题
  
  // 新增字段
  imageUrl: varchar('image_url', { length: 1000 }), // 商品主图URL
  images: jsonb('images'), // 图片URL数组
  brandName: varchar('brand_name', { length: 200 }), // 品牌名称
  previousSignalId: integer('previous_signal_id'), // 历史趋势链
  
  // 价格与销量
  currentPrice: numeric('current_price', { precision: 12, scale: 2 }),
  originalPrice: numeric('original_price', { precision: 12, scale: 2 }),
  discountPercent: numeric('discount_percent', { precision: 5, scale: 2 }),
  monthlySales: integer('monthly_sales').default(0),
  
  // 评价数据
  rating: numeric('rating', { precision: 3, scale: 2 }),
  reviewsCount: integer('reviews_count').default(0),
  
  // 竞争数据
  sellerCount: integer('seller_count').default(0),
  isOzonSeller: boolean('is_ozon_seller').default(false),
  
  // 类目信息
  categoryId: varchar('category_id', { length: 50 }),
  categoryName: varchar('category_name', { length: 200 }),
  
  // 采集元数据
  sourceUrl: varchar('source_url', { length: 1000 }),
  collectedAt: timestamp('collected_at', { withTimezone: true }).defaultNow(),
  
  // 原始数据
  rawData: jsonb('raw_data'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_market_signals_shop').on(table.shopId),
  index('idx_market_signals_product').on(table.ozonProductId),
  index('idx_market_signals_collected').on(table.collectedAt),
]);

/**
 * Chrome插件API密钥表 - 插件鉴权
 */
export const extensionApiKeys = pgTable('extension_api_keys', {
  id: serial('id').primaryKey(),
  keyHash: varchar('key_hash', { length: 64 }).notNull(), // SHA256哈希
  keyPrefix: varchar('key_prefix', { length: 8 }).notNull(), // 密钥前8位
  shopId: varchar('shop_id', { length: 36 }).notNull().references(() => shops.id),
  userId: varchar('user_id', { length: 50 }).notNull(),
  permissions: jsonb('permissions').default(sql`'["read:signals", "write:signals"]'::jsonb`),
  deviceInfo: varchar('device_info', { length: 200 }),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  uniqueIndex('idx_ext_api_key_hash').on(table.keyHash),
  index('idx_ext_api_key_shop').on(table.shopId),
]);

// ============================================================================
// 类型导出
// ============================================================================

export type EacConfig = typeof eacConfig.$inferSelect;
export type Opportunity = typeof opportunities.$inferSelect;
export type ProductCard = typeof productCards.$inferSelect;
export type ProductVariant = typeof productVariants.$inferSelect;
export type ImageSet = typeof imageSets.$inferSelect;
export type ImageTemplate = typeof imageTemplates.$inferSelect;
export type ListingTask = typeof listingTasks.$inferSelect;
export type ProductScore = typeof productScores.$inferSelect;
export type AhpWeight = typeof ahpWeights.$inferSelect;
export type ProductEmbedding = typeof productEmbeddings.$inferSelect;
export type ProphetForecast = typeof prophetForecasts.$inferSelect;
export type SelectionStrategyTemplate = typeof selectionStrategyTemplates.$inferSelect;
export type DataSourceHealth = typeof dataSourceHealth.$inferSelect;
export type SelectionRetrospective = typeof selectionRetrospectives.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type OzonKnowledgeCache = typeof ozonKnowledgeCache.$inferSelect;
export type PolicyChangeEvent = typeof policyChangeEvents.$inferSelect;
export type SyncSchedule = typeof syncSchedules.$inferSelect;
export type MarketSignal = typeof marketSignals.$inferSelect;
export type ExtensionApiKey = typeof extensionApiKeys.$inferSelect;
