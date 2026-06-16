import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, numeric, jsonb, index, serial, uniqueIndex, boolean, decimal } from "drizzle-orm/pg-core";

// ============================================================================
// 履约模块 (Fulfillment Module)
// 订单同步 → 采购需求 → 采购记录 → 验货 → 发货 → 财务核算
// ============================================================================

/**
 * ozon_orders - Ozon订单表
 * 存储从Ozon同步的原始订单数据
 */
export const ozonOrders = pgTable('ozon_orders', {
  id: serial('id').primaryKey(),
  shopId: varchar('shop_id', { length: 36 }).notNull(), // 外键关联 shops.id (varchar)
  ozonOrderId: varchar('ozon_order_id', { length: 50 }).notNull(),
  ozonPostingNumber: varchar('ozon_posting_number', { length: 50 }),
  orderStatus: varchar('order_status', { length: 30 }).notNull(), // Ozon原始状态
  erpStatus: varchar('erp_status', { length: 20 }).default('pending'), // ERP内部状态机
  customerName: varchar('customer_name', { length: 100 }),
  deliveryAddress: text('delivery_address'),
  orderAmount: numeric('order_amount', { precision: 10, scale: 2 }), // RUB金额
  currency: varchar('currency', { length: 10 }).default('RUB'),
  itemsJson: jsonb('items_json').$type<Array<{ sku: string; name: string; qty: number; price: number }>>(),
  shipmentDeadline: timestamp('shipment_deadline', { withTimezone: true }), // Ozon发货截止时间
  orderTime: timestamp('order_time', { withTimezone: true }),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('idx_ozon_orders_shop_ozon_id').on(table.shopId, table.ozonOrderId),
  index('idx_ozon_orders_shop').on(table.shopId),
  index('idx_ozon_orders_erp_status').on(table.erpStatus),
  index('idx_ozon_orders_order_time').on(table.orderTime),
  index('idx_ozon_orders_shipment_deadline').on(table.shipmentDeadline),
]);

/**
 * purchase_demands - 采购需求表
 * 从Ozon订单生成的采购需求
 */
export const purchaseDemands = pgTable('purchase_demands', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull().references(() => ozonOrders.id, { onDelete: 'cascade' }),
  sku: varchar('sku', { length: 100 }).notNull(),
  productName: varchar('product_name', { length: 200 }),
  productImage: varchar('product_image', { length: 500 }),
  quantity: integer('quantity').default(1),
  priority: varchar('priority', { length: 10 }).default('normal'), // high/normal/low
  status: varchar('status', { length: 20 }).default('pending'), // pending/purchased/cancelled
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_purchase_demands_order').on(table.orderId),
  index('idx_purchase_demands_sku').on(table.sku),
  index('idx_purchase_demands_status').on(table.status),
  index('idx_purchase_demands_priority').on(table.priority),
]);

/**
 * purchase_records - 采购记录表
 * 记录实际采购操作的详细信息
 */
export const purchaseRecords = pgTable('purchase_records', {
  id: serial('id').primaryKey(),
  demandId: integer('demand_id').notNull().references(() => purchaseDemands.id, { onDelete: 'cascade' }),
  shopId: varchar('shop_id', { length: 36 }).notNull(), // 外键关联 shops.id (varchar)
  ozonOrderIds: jsonb('ozon_order_ids').$type<number[]>(), // 聚合采购时对应的多个Ozon订单ID
  supplierName: varchar('supplier_name', { length: 200 }),
  supplierSource: varchar('supplier_source', { length: 20 }), // 1688/pdd/manual
  sourceUrl: varchar('source_url', { length: 500 }),
  purchasePrice: numeric('purchase_price', { precision: 10, scale: 2 }),
  purchaseQty: integer('purchase_qty').default(1),
  totalPurchaseCost: numeric('total_purchase_cost', { precision: 10, scale: 2 }),
  shippingFee: numeric('shipping_fee', { precision: 10, scale: 2 }).default('0'),
  domesticTrackingNo: varchar('domestic_tracking_no', { length: 100 }), // 国内快递单号，扫码匹配键
  domesticCarrier: varchar('domestic_carrier', { length: 50 }),
  domesticStatus: varchar('domestic_status', { length: 20 }).default('pending'), // pending/shipped/received
  status: varchar('status', { length: 20 }).default('ordered'), // ordered/shipped/received/verified/exception
  exceptionType: varchar('exception_type', { length: 30 }), // wrong_item/wrong_qty/quality/wrong_spec/damaged
  orderedAt: timestamp('ordered_at', { withTimezone: true }),
  receivedAt: timestamp('received_at', { withTimezone: true }),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  // 人员操作记录
  purchaserId: varchar('purchaser_id', { length: 36 }), // 采购员ID
  boundBy: varchar('bound_by', { length: 50 }), // 绑定操作人
  remark: text('remark'), // 备注
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_purchase_records_demand').on(table.demandId),
  index('idx_purchase_records_shop').on(table.shopId),
  index('idx_purchase_records_domestic_tracking').on(table.domesticTrackingNo),
  index('idx_purchase_records_status').on(table.status),
  index('idx_purchase_records_ordered_at').on(table.orderedAt),
  index('idx_purchase_records_purchaser').on(table.purchaserId),
]);

/**
 * qc_records - 验货记录表
 * 仓库验货的质量检查记录
 */
export const qcRecords = pgTable('qc_records', {
  id: serial('id').primaryKey(),
  purchaseId: integer('purchase_id').notNull().references(() => purchaseRecords.id, { onDelete: 'cascade' }),
  expressNo: varchar('express_no', { length: 100 }).notNull(),
  ozonOrderId: integer('ozon_order_id').references(() => ozonOrders.id),
  qcResult: varchar('qc_result', { length: 20 }).notNull(), // pass/fail/partial
  checkItems: jsonb('check_items'),
  quantityExpected: integer('quantity_expected'),
  quantityActual: integer('quantity_actual'),
  exceptionType: varchar('exception_type', { length: 30 }),
  remark: text('remark'),
  operator: varchar('operator', { length: 50 }),
  qcTime: timestamp('qc_time', { withTimezone: true }).defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_qc_records_purchase').on(table.purchaseId),
  index('idx_qc_records_express').on(table.expressNo),
  index('idx_qc_records_result').on(table.qcResult),
  index('idx_qc_records_qc_time').on(table.qcTime),
]);

/**
 * shipment_records - 发货记录表
 * 打包发货的详细信息
 */
export const shipmentRecords = pgTable('shipment_records', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull().references(() => ozonOrders.id, { onDelete: 'cascade' }),
  shopId: varchar('shop_id', { length: 36 }).notNull(), // 外键关联 shops.id (varchar)
  packageCount: integer('package_count').default(1),
  packages: jsonb('packages').$type<Array<{ weight: number; dimensions: string; trackingNo: string }>>(),
  totalWeight: numeric('total_weight', { precision: 8, scale: 3 }), // kg
  packingMaterial: varchar('packing_material', { length: 50 }),
  packingCost: numeric('packing_cost', { precision: 10, scale: 2 }).default('0'),
  ozonTrackingNumber: varchar('ozon_tracking_number', { length: 100 }),
  shippingMethod: varchar('shipping_method', { length: 50 }),
  internationalShippingCost: numeric('international_shipping_cost', { precision: 10, scale: 2 }).default('0'),
  operator: varchar('operator', { length: 50 }),
  shipTime: timestamp('ship_time', { withTimezone: true }),
  status: varchar('status', { length: 20 }).default('packed'), // packed/labeled/shipped
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_shipment_records_order').on(table.orderId),
  index('idx_shipment_records_shop').on(table.shopId),
  index('idx_shipment_records_status').on(table.status),
  index('idx_shipment_records_ship_time').on(table.shipTime),
  index('idx_shipment_records_tracking').on(table.ozonTrackingNumber),
]);

/**
 * order_finance - 订单财务表
 * 订单的完整财务核算数据
 */
export const orderFinance = pgTable('order_finance', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull().references(() => ozonOrders.id, { onDelete: 'cascade' }),
  shopId: varchar('shop_id', { length: 36 }).notNull(), // 外键关联 shops.id (varchar)
  ozonSettlementAmount: numeric('ozon_settlement_amount', { precision: 10, scale: 2 }), // Ozon结算金额RUB
  exchangeRate: numeric('exchange_rate', { precision: 10, scale: 6 }), // 下单时汇率
  settlementAmountCny: numeric('settlement_amount_cny', { precision: 10, scale: 2 }), // 售价折人民币
  purchaseCost: numeric('purchase_cost', { precision: 10, scale: 2 }).default('0'),
  domesticShippingCost: numeric('domestic_shipping_cost', { precision: 10, scale: 2 }).default('0'), // 国内运费
  ozonCommission: numeric('ozon_commission', { precision: 10, scale: 2 }).default('0'),
  ozonCommissionRate: numeric('ozon_commission_rate', { precision: 5, scale: 4 }),
  ozonPaymentFee: numeric('ozon_payment_fee', { precision: 10, scale: 2 }).default('0'),
  internationalShippingCost: numeric('international_shipping_cost', { precision: 10, scale: 2 }).default('0'),
  packagingCost: numeric('packaging_cost', { precision: 10, scale: 2 }).default('0'),
  actualWeight: numeric('actual_weight', { precision: 8, scale: 3 }), // 实际称重kg
  weightSource: varchar('weight_source', { length: 20 }).default('manual'), // scale/manual
  estimatedShippingCost: numeric('estimated_shipping_cost', { precision: 10, scale: 2 }).default('0'), // 预估国际运费
  logisticsBillAmount: numeric('logistics_bill_amount', { precision: 10, scale: 2 }).default('0'), // 物流账单实际扣费
  freightVariance: numeric('freight_variance', { precision: 10, scale: 2 }).default('0'), // 运费差异
  freightReconciled: integer('freight_reconciled').default(0), // 0未核对/1已核对
  reconciledAt: timestamp('reconciled_at', { withTimezone: true }),
  grossProfit: numeric('gross_profit', { precision: 10, scale: 2 }),
  netProfit: numeric('net_profit', { precision: 10, scale: 2 }),
  netMargin: numeric('net_margin', { precision: 5, scale: 2 }),
  sharedCostAllocated: numeric('shared_cost_allocated', { precision: 10, scale: 2 }).default('0'),
  settlementExchangeRate: numeric('settlement_exchange_rate', { precision: 10, scale: 6 }),
  exchangeGainLoss: numeric('exchange_gain_loss', { precision: 10, scale: 2 }).default('0'),
  status: varchar('status', { length: 20 }).default('estimated'), // estimated/settled
  settledAt: timestamp('settled_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_order_finance_order').on(table.orderId),
  index('idx_order_finance_shop_created').on(table.shopId, table.createdAt),
  index('idx_order_finance_status').on(table.status),
  index('idx_order_finance_settled_at').on(table.settledAt),
]);

// ============================================================================
// 类型导出
// ============================================================================

export type OzonOrder = typeof ozonOrders.$inferSelect;
export type InsertOzonOrder = typeof ozonOrders.$inferInsert;
export type PurchaseDemand = typeof purchaseDemands.$inferSelect;
export type InsertPurchaseDemand = typeof purchaseDemands.$inferInsert;
export type PurchaseRecord = typeof purchaseRecords.$inferSelect;
export type InsertPurchaseRecord = typeof purchaseRecords.$inferInsert;
export type QcRecord = typeof qcRecords.$inferSelect;
export type InsertQcRecord = typeof qcRecords.$inferInsert;
export type ShipmentRecord = typeof shipmentRecords.$inferSelect;
export type InsertShipmentRecord = typeof shipmentRecords.$inferInsert;
export type OrderFinance = typeof orderFinance.$inferSelect;
export type InsertOrderFinance = typeof orderFinance.$inferInsert;
