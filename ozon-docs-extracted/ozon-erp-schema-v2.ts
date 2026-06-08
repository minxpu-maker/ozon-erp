// ============================================================================
// Ozon ERP — Drizzle ORM Schema V2
// 架构设计V2 + 选品算法V2 + 平台知识库 + 文档审查27项遗漏修复
// 技术栈: Next.js 16 + React 19 + TypeScript 5 + Drizzle ORM 0.45 + PostgreSQL + pgvector
//
// V2 变更日志（相比V1）:
// - [P0] 新增5张缺表: imageTemplates / selectionStrategyTemplates / dataSourceHealth / selectionRetrospectives / notifications
// - [P0] 新增productVariants表（SKU粒度，D-026）
// - [P0] 补10个缺字段: imageSets(templateId/reviewerId/aiEditProvider/aiEditParams) / listingTasks(logisticsTemplateId/packageWeight/packageDimensions) / shops(apiRateLimitRemaining/apiRateLimitResetAt/defaultLogisticsTemplateId) / productScores(expiresAt) / opportunities(assignedTo)
// - [P0] 解决EAC双重存储矛盾: 去掉shops.eacPolicy，统一从eacConfig读取（D-014修正）
// - [P1] 补4个缺关系 + 6个缺索引
// - [P2] pgvector自定义类型定义 + HNSW索引
// ============================================================================

import {
  pgTable, serial, varchar, integer, decimal, boolean, text,
  timestamp, date, jsonb, index, uniqueIndex, customType,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================================================
// pgvector 自定义类型（P2: 一期可用jsonb降级，二期切pgvector+HNSW）
// ============================================================================

export const vector = customType<{ data: number[]; driverData: string }>({
  dataType(dimensions: number) {
    return `vector(${dimensions})`;
  },
  toDriver(value: number[]) {
    return `[${value.join(',')}]`;
  },
  fromDriver(value: string) {
    return value.slice(1, -1).split(',').map(Number);
  },
});

// ============================================================================
// 一、店铺管理
// ============================================================================

/**
 * 店铺信息表 — 多店铺支持，API认证按店铺隔离
 * D-006: 一期即支持多店铺
 * D-029: API频率限制跟踪
 *
 * [V2变更] 去掉eacPolicy字段，统一从eacConfig读取（解决EAC双重存储矛盾）
 * [V2变更] 新增apiRateLimitRemaining/apiRateLimitResetAt/defaultLogisticsTemplateId
 */
export const shops = pgTable('shops', {
  id: serial('id').primaryKey(),
  ozonClientId: varchar('ozon_client_id', { length: 50 }).notNull(),
  ozonApiKey: varchar('ozon_api_key', { length: 200 }).notNull(),
  shopName: varchar('shop_name', { length: 200 }).notNull(),
  sellerType: varchar('seller_type', { length: 20 }).default('cn_crossborder'), // cn_crossborder / ru_local
  shopCreatedAt: timestamp('shop_created_at'),
  currentStage: varchar('current_stage', { length: 20 }).default('new'), // new / growing / mature
  selectionMode: varchar('selection_mode', { length: 20 }).default('follow'), // follow / refine
  priceRangeMin: integer('price_range_min').default(200),
  priceRangeMax: integer('price_range_max').default(1500),
  // [V2删除] eacPolicy: 统一从eacConfig表读取，避免双重存储不一致
  highReviewLinkCount: integer('high_review_link_count').default(0),
  lastStageCheckAt: timestamp('last_stage_check_at'),
  // [V2新增] API频率限制跟踪（D-029）
  apiRateLimitRemaining: integer('api_rate_limit_remaining'),       // 剩余API调用次数
  apiRateLimitResetAt: timestamp('api_rate_limit_reset_at'),         // 频率限制重置时间
  // [V2新增] 默认物流模板
  defaultLogisticsTemplateId: integer('default_logistics_template_id'), // 店铺默认物流模板ID
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  uniqueIndex('idx_shops_ozon_client_id').on(table.ozonClientId),
]);

/** 店铺关系 */
export const shopsRelations = relations(shops, ({ many }) => ({
  opportunities: many(opportunities),
  productCards: many(productCards),
  listingTasks: many(listingTasks),
  strategyTemplates: many(selectionStrategyTemplates),
  retrospectives: many(selectionRetrospectives),
}));

/**
 * EAC认证配置表 — 一键切换能力（EAC策略的唯一数据源）
 * D-014: 俄本土卖家一票否决，中国卖家风险提示（预留一键切换）
 *
 * [V2说明] shops表不再存eacPolicy，所有EAC策略查询统一走此表
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
// D-004: 选品单、商品卡、SKU(变体)、图片集、上架任务
// D-026: 商品卡+SKU双层粒度
// ============================================================================

/**
 * 选品单 (Opportunity) — 记录一个选品机会
 * 生命周期: 发现 → 评估 → 确认/放弃
 *
 * [V2新增] assignedTo: 选品单归属运营人员
 * [V2新增] parentOpportunityId: 跟卖→精铺转化时关联原选品单（D-027）
 */
export const opportunities = pgTable('opportunities', {
  id: serial('id').primaryKey(),
  shopId: integer('shop_id').references(() => shops.id, { onDelete: 'cascade' }).notNull(),

  // 选品来源
  source: varchar('source', { length: 20 }).notNull(),         // system_recommend / ai_deep_dive
  selectionMode: varchar('selection_mode', { length: 20 }).notNull(), // follow / refine

  // 选品目标
  targetType: varchar('target_type', { length: 20 }).notNull(),  // category / product
  targetCategoryId: integer('target_category_id'),
  targetProductId: integer('target_product_id'),
  targetName: varchar('target_name', { length: 500 }),

  // 市场分析概要
  marketAnalysis: jsonb('market_analysis'),
  profitEstimate: jsonb('profit_estimate'),
  riskFlags: jsonb('risk_flags'),

  // 状态
  status: varchar('status', { length: 20 }).default('discovered'), // discovered / evaluating / confirmed / abandoned
  confirmedAt: timestamp('confirmed_at'),
  abandonedReason: text('abandoned_reason'),

  // [V2新增] 归属与转化关联
  assignedTo: varchar('assigned_to', { length: 50 }),           // 归属运营人员
  parentOpportunityId: integer('parent_opportunity_id'),          // 跟卖→精铺转化时关联原选品单

  // 元数据
  dataSources: jsonb('data_sources'),
  strategyTemplateId: integer('strategy_template_id'),           // [V2新增] 使用的策略模板
  notes: text('notes'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  index('idx_opportunities_shop_id').on(table.shopId),
  index('idx_opportunities_status').on(table.status),
  index('idx_opportunities_category').on(table.targetCategoryId),
  // [V2新增] 高频查询复合索引
  index('idx_opportunities_shop_status_mode').on(table.shopId, table.status, table.selectionMode),
]);

/** 选品单关系 */
export const opportunitiesRelations = relations(opportunities, ({ one, many }) => ({
  shop: one(shops, { fields: [opportunities.shopId], references: [shops.id] }),
  parentOpportunity: one(opportunities, { fields: [opportunities.parentOpportunityId], references: [opportunities.id], relationName: 'opportunityConversion' }),
  childOpportunities: many(opportunities, { relationName: 'opportunityConversion' }),
  productCards: many(productCards),
  scores: many(productScores),
  strategyTemplate: one(selectionStrategyTemplates, { fields: [opportunities.strategyTemplateId], references: [selectionStrategyTemplates.id] }),
  retrospective: one(selectionRetrospectives, { fields: [opportunities.id], references: [selectionRetrospectives.opportunityId] }),
}));

/**
 * 商品卡 (Product Card) — 准备上架的商品完整信息（SPU级）
 * 生命周期: 创建 → 信息填充 → 修图关联 → 待上架 → 已上架
 *
 * [V2说明] 商品卡是SPU级别，SKU/变体信息在productVariants表中
 * D-026: 商品卡+SKU双层粒度
 */
export const productCards = pgTable('product_cards', {
  id: serial('id').primaryKey(),
  shopId: integer('shop_id').references(() => shops.id, { onDelete: 'cascade' }).notNull(),
  opportunityId: integer('opportunity_id').references(() => opportunities.id),

  // Ozon类目信息
  ozonCategoryId: integer('ozon_category_id').notNull(),
  ozonCategoryName: varchar('ozon_category_name', { length: 500 }),

  // 商品信息（SPU级，通用信息）
  titleRu: varchar('title_ru', { length: 500 }),
  titleZh: varchar('title_zh', { length: 500 }),
  description: text('description_ru'),
  attributes: jsonb('attributes'),                          // Ozon属性键值对（SPU级属性）
  variantAttributes: jsonb('variant_attributes'),           // 变体维度定义（如颜色/尺码）

  // 定价（SPU参考价，实际定价在productVariants）
  suggestedPrice: integer('suggested_price'),
  costPrice: integer('cost_price'),                         // 1688成本价(₽等值)
  commissionRate: decimal('commission_rate', { precision: 5, scale: 2 }),

  // 状态
  status: varchar('status', { length: 20 }).default('draft'), // draft / info_filled / image_linked / ready_to_list / listed
  isEacRequired: boolean('is_eac_required').default(false),
  eacStatus: varchar('eac_status', { length: 20 }).default('none'), // none / pending / certified

  // 来源
  source1688Url: text('source_1688_url'),
  sourceOzonUrl: text('source_ozon_url'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  index('idx_product_cards_shop_id').on(table.shopId),
  index('idx_product_cards_status').on(table.status),
  index('idx_product_cards_category').on(table.ozonCategoryId),
  // [V2新增] 流程总览看板高频查询
  index('idx_product_cards_shop_status_created').on(table.shopId, table.status, table.createdAt),
]);

/** 商品卡关系 */
export const productCardsRelations = relations(productCards, ({ one, many }) => ({
  shop: one(shops, { fields: [productCards.shopId], references: [shops.id] }),
  opportunity: one(opportunities, { fields: [productCards.opportunityId], references: [opportunities.id] }),
  variants: many(productVariants),
  imageSets: many(imageSets),
  listingTasks: many(listingTasks),
  scores: many(productScores),
  embeddings: many(productEmbeddings),
}));

/**
 * 商品变体/SKU表 — Ozon实际SKU级操作
 * D-026: 商品卡(SPU) + 变体(SKU) 双层粒度
 *
 * 每个变体有独立的价格、库存、图片（Ozon上架API是SKU维度提交）
 * [V2新增表]
 */
export const productVariants = pgTable('product_variants', {
  id: serial('id').primaryKey(),
  productCardId: integer('product_card_id').references(() => productCards.id, { onDelete: 'cascade' }).notNull(),

  // 变体属性
  variantName: varchar('variant_name', { length: 200 }),       // 如 "红色-XL"
  variantValues: jsonb('variant_values').notNull(),            // { "颜色": "红色", "尺码": "XL" }
  ozonVariantId: varchar('ozon_variant_id', { length: 50 }),   // Ozon SKU ID（上架后回填）

  // 定价（SKU级独立定价）
  confirmedPrice: integer('confirmed_price'),                  // 人工确认价(₽) — D-007
  costPrice: integer('cost_price'),                            // 该变体成本价（可能不同规格不同成本）
  stock: integer('stock').default(0),                          // 库存数量

  // 图片关联（变体级主图）
  primaryImageSetId: integer('primary_image_set_id'),          // 该变体的主图集

  // 状态
  status: varchar('status', { length: 20 }).default('draft'),  // draft / ready / listed

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  index('idx_product_variants_product_card_id').on(table.productCardId),
  index('idx_product_variants_ozon_id').on(table.ozonVariantId),
]);

/** 变体关系 */
export const productVariantsRelations = relations(productVariants, ({ one, many }) => ({
  productCard: one(productCards, { fields: [productVariants.productCardId], references: [productCards.id] }),
  primaryImageSet: one(imageSets, { fields: [productVariants.primaryImageSetId], references: [imageSets.id] }),
  listingTasks: many(listingTasks),
}));

/**
 * 图片集 (Image Set) — 一个商品卡/变体的图片组
 * D-007: 修图必须人工审核
 *
 * [V2新增] templateId: 关联修图模板
 * [V2新增] reviewerId: 审核人记录（审计追溯）
 * [V2新增] aiEditProvider/aiEditParams: AI修图服务记录
 */
export const imageSets = pgTable('image_sets', {
  id: serial('id').primaryKey(),
  productCardId: integer('product_card_id').references(() => productCards.id, { onDelete: 'cascade' }).notNull(),
  variantId: integer('variant_id').references(() => productVariants.id),  // [V2新增] 关联到具体变体

  // 原图
  originalImages: jsonb('original_images').notNull(),   // [{ key: S3Key, url, size, uploadedAt, sourceType: '1688'|'upload'|'ozon', sourceUrl }]

  // 修后图
  processedImages: jsonb('processed_images'),           // [{ key: S3Key, url, aiGenerated: bool }]

  // 主图
  primaryImageIndex: integer('primary_image_index').default(0),

  // 修图模板关联 [V2新增]
  templateId: integer('template_id').references(() => imageTemplates.id),  // 使用的修图模板

  // AI修图记录 [V2新增]
  aiEditProvider: varchar('ai_edit_provider', { length: 50 }),   // 使用的AI修图服务（如 removal.ai / stable_diffusion）
  aiEditParams: jsonb('ai_edit_params'),                         // AI修图参数快照

  // 合规检查 [V2新增]
  complianceChecks: jsonb('compliance_checks'),  // [{ rule: 'size', passed: true, detail: '1200x1200' }, ...]

  // 状态
  status: varchar('status', { length: 20 }).default('created'), // created / ai_processing / pending_review / approved / rejected

  // 审核记录 [V2新增]
  reviewerId: varchar('reviewer_id', { length: 50 }),           // 审核人ID（D-007审计追溯）
  reviewedAt: timestamp('reviewed_at'),
  rejectReason: text('reject_reason'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  index('idx_image_sets_product_card_id').on(table.productCardId),
  index('idx_image_sets_template_id').on(table.templateId),
  // [V2新增] 修图工作台高频查询
  index('idx_image_sets_status_product_card').on(table.status, table.productCardId),
]);

/** 图片集关系 */
export const imageSetsRelations = relations(imageSets, ({ one }) => ({
  productCard: one(productCards, { fields: [imageSets.productCardId], references: [productCards.id] }),
  variant: one(productVariants, { fields: [imageSets.variantId], references: [productVariants.id] }),
  template: one(imageTemplates, { fields: [imageSets.templateId], references: [imageTemplates.id] }),
}));

/**
 * 上架任务 (Listing Task) — 一次上架动作的记录
 *
 * [V2新增] logisticsTemplateId: 物流模板选择
 * [V2新增] packageWeight/packageDimensions: 包裹参数
 * [V2新增] variantId: SKU维度上架
 */
export const listingTasks = pgTable('listing_tasks', {
  id: serial('id').primaryKey(),
  productCardId: integer('product_card_id').references(() => productCards.id, { onDelete: 'cascade' }).notNull(),
  shopId: integer('shop_id').references(() => shops.id, { onDelete: 'cascade' }).notNull(),
  variantId: integer('variant_id').references(() => productVariants.id),  // [V2新增] SKU维度上架

  // Ozon返回
  ozonTaskId: integer('ozon_task_id'),
  ozonProductId: varchar('ozon_product_id', { length: 50 }),

  // 状态
  status: varchar('status', { length: 20 }).default('created'), // created / submitting / pending / approved / rejected

  // 物流配置 [V2新增]
  logisticsTemplateId: integer('logistics_template_id'),        // 物流模板ID
  packageWeight: decimal('package_weight', { precision: 8, scale: 2 }),     // 包裹重量(g)
  packageDimensions: jsonb('package_dimensions'),               // { length, width, height } cm

  // 结果
  resultMessage: text('result_message'),
  lastPollAt: timestamp('last_poll_at'),

  // 错误与重试
  failureReason: text('failure_reason'),
  retryCount: integer('retry_count').default(0),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  index('idx_listing_tasks_product_card_id').on(table.productCardId),
  index('idx_listing_tasks_shop_id').on(table.shopId),
  index('idx_listing_tasks_status').on(table.status),
  // [V2新增] 上架管理高频查询
  index('idx_listing_tasks_status_created').on(table.status, table.createdAt),
]);

/** 上架任务关系 */
export const listingTasksRelations = relations(listingTasks, ({ one }) => ({
  productCard: one(productCards, { fields: [listingTasks.productCardId], references: [productCards.id] }),
  shop: one(shops, { fields: [listingTasks.shopId], references: [shops.id] }),
  variant: one(productVariants, { fields: [listingTasks.variantId], references: [productVariants.id] }),
}));

// ============================================================================
// 三、修图模板管理 [V2新增表]
// D-021: 修图模板管理一期实现
// ============================================================================

/**
 * 修图模板表 — 白底图/场景图预设风格库
 * 绑定Ozon图片规范（尺寸/水印要求）
 */
export const imageTemplates = pgTable('image_templates', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 200 }).notNull(),             // 模板名称
  type: varchar('type', { length: 30 }).notNull(),              // white_bg / scene / lifestyle / custom

  // 模板配置
  config: jsonb('config').notNull(),  // { background: '#FFFFFF', overlay: null, dimensions: { width: 1200, height: 1200 }, watermark: false, padding: 20 }

  // Ozon图片规范绑定
  ozonSpec: jsonb('ozon_spec'),     // { minSize: 400, recommendedSize: 1200, aspectRatio: '1:1', format: 'JPEG/PNG', whiteBackground: true, noWatermark: true, noTextOnMain: true }

  // 预览图
  previewImageKey: varchar('preview_image_key', { length: 500 }),

  // 适用类目（可选，null=通用模板）
  applicableCategoryIds: jsonb('applicable_category_ids'),      // [123, 456, ...]

  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  index('idx_image_templates_type').on(table.type),
]);

/** 修图模板关系 */
export const imageTemplatesRelations = relations(imageTemplates, ({ many }) => ({
  imageSets: many(imageSets),
}));

// ============================================================================
// 四、选品策略模板 [V2新增表]
// ============================================================================

/**
 * 选品策略模板表 — 保存多套策略配置
 * 含五维权重、硬约束阈值、价格范围
 */
export const selectionStrategyTemplates = pgTable('selection_strategy_templates', {
  id: serial('id').primaryKey(),
  shopId: integer('shop_id').references(() => shops.id),        // null=全局模板
  name: varchar('name', { length: 200 }).notNull(),             // 如 "跟卖低风险"、"精铺高利润"
  selectionMode: varchar('selection_mode', { length: 20 }).notNull(), // follow / refine

  // AHP权重配置
  ahpConfig: jsonb('ahp_config'),         // { judgmentMatrix: [[...],...], alpha: 0.5 }

  // 硬约束阈值
  hardConstraints: jsonb('hard_constraints'), // { priceRange: { min: 200, max: 1500 }, minReviews: 20, maxSellers: 50 }

  // 价格范围
  priceRangeMin: integer('price_range_min'),
  priceRangeMax: integer('price_range_max'),

  isDefault: boolean('is_default').default(false),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  index('idx_strategy_templates_shop_mode').on(table.shopId, table.selectionMode),
]);

/** 策略模板关系 */
export const selectionStrategyTemplatesRelations = relations(selectionStrategyTemplates, ({ one, many }) => ({
  shop: one(shops, { fields: [selectionStrategyTemplates.shopId], references: [shops.id] }),
  opportunities: many(opportunities),
}));

// ============================================================================
// 五、选品算法相关表
// ============================================================================

/**
 * 综合评分结果表 — 六层递进算法的最终输出
 *
 * [V2新增] expiresAt: 评分时效性，过期触发重算
 */
export const productScores = pgTable('product_scores', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').references(() => productCards.id, { onDelete: 'cascade' }).notNull(),
  shopId: integer('shop_id').references(() => shops.id).notNull(),
  opportunityId: integer('opportunity_id').references(() => opportunities.id),

  // 店铺阶段上下文
  shopStage: varchar('shop_stage', { length: 20 }),
  sellerType: varchar('seller_type', { length: 20 }),
  selectionMode: varchar('selection_mode', { length: 20 }),

  // 第一层：硬约束折扣
  hardConstraintDiscount: decimal('hard_constraint_discount', { precision: 3, scale: 2 }).default('1.00'),
  hardConstraintDetails: jsonb('hard_constraint_details'),

  // 第二层：组合赋权结果
  ahpWeights: jsonb('ahp_weights'),
  entropyWeights: jsonb('entropy_weights'),
  combinedWeights: jsonb('combined_weights'),

  // 通道A：AHP-TOPSIS评分
  topsisScore: decimal('topsis_score', { precision: 5, scale: 4 }),
  demandScore: decimal('demand_score', { precision: 5, scale: 4 }),
  competitionScore: decimal('competition_score', { precision: 5, scale: 4 }),
  profitScore: decimal('profit_score', { precision: 5, scale: 4 }),
  supplyScore: decimal('supply_score', { precision: 5, scale: 4 }),
  riskScore: decimal('risk_score', { precision: 5, scale: 4 }),

  // 通道B：语义评分
  semanticScore: decimal('semantic_score', { precision: 5, scale: 4 }),

  // 第四层：Prophet预测
  predictedSales7d: integer('predicted_sales_7d'),
  predictedSales30d: integer('predicted_sales_30d'),
  trendDirection: varchar('trend_direction', { length: 10 }),
  trendChangepoints: jsonb('trend_changepoints'),

  // 机会指数
  opportunityIndex: decimal('opportunity_index', { precision: 5, scale: 4 }),

  // 交叉验证折扣
  crossVerifyDiscount: decimal('cross_verify_discount', { precision: 3, scale: 2 }).default('1.00'),
  crossVerifyResult: jsonb('cross_verify_result'),

  // 综合评分
  compositeScore: decimal('composite_score', { precision: 5, scale: 4 }),
  grade: varchar('grade', { length: 1 }),

  // 跟卖特有字段
  followSignal: varchar('follow_signal', { length: 20 }),
  sellerCountOnShelf: integer('seller_count_on_shelf'),

  // 精铺特有字段
  differentiationScore: decimal('differentiation_score', { precision: 5, scale: 4 }),
  negativeReviewKeywords: jsonb('negative_review_keywords'),

  // EAC风险标记
  eacRiskLevel: varchar('eac_risk_level', { length: 10 }),

  // LLM推理输出（第五层）
  llmInsight: jsonb('llm_insight'),

  calculatedAt: timestamp('calculated_at').defaultNow(),
  // [V2新增] 评分时效性
  expiresAt: timestamp('expires_at'),                           // 评分过期时间，过期后触发重算
}, (table) => [
  index('idx_product_scores_product_id').on(table.productId),
  index('idx_product_scores_shop_id').on(table.shopId),
  index('idx_product_scores_grade').on(table.grade),
  index('idx_product_scores_composite').on(table.compositeScore),
  // [V2新增] 选品看板排序高频查询
  index('idx_product_scores_shop_mode_composite').on(table.shopId, table.selectionMode, table.compositeScore),
]);

/** 评分结果关系 */
export const productScoresRelations = relations(productScores, ({ one }) => ({
  product: one(productCards, { fields: [productScores.productId], references: [productCards.id] }),
  opportunity: one(opportunities, { fields: [productScores.opportunityId], references: [opportunities.id] }),
  shop: one(shops, { fields: [productScores.shopId], references: [shops.id] }),
}));

/**
 * AHP权重配置表 — 每品类×阶段独立权重矩阵
 * D-015: 品类独立建模
 * D-017: 跟卖/精铺用不同AHP判断矩阵
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
 * 产品Embedding表 — pgvector向量存储
 * D-012: LLM Embedding + LightGBM语义评分
 *
 * [V2说明] embedding字段使用自定义vector类型
 * [P2降级] 一期可用jsonb+应用层余弦计算（候选<10万可接受），二期上pgvector+HNSW
 * 需要 PG 扩展: CREATE EXTENSION IF NOT EXISTS vector;
 */
export const productEmbeddings = pgTable('product_embeddings', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').references(() => productCards.id, { onDelete: 'cascade' }).notNull(),

  // 向量数据 — pgvector扩展
  embedding: vector('embedding', { dimensions: 1536 }),

  embeddingSource: varchar('embedding_source', { length: 50 }),
  model: varchar('model', { length: 50 }).default('text-embedding-3-small'),
  textHash: varchar('text_hash', { length: 64 }),

  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index('idx_product_embeddings_product_id').on(table.productId),
]);

/**
 * Prophet预测缓存表
 * D-013: Prophet + 俄罗斯假期日历
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
  // [V2新增] 取最新预测
  index('idx_prophet_target_date_desc').on(table.targetType, table.targetId, table.forecastDate),
]);

// ============================================================================
// 六、数据源健康度 [V2新增表]
// D-024: 数据源健康度看板一期实现
// ============================================================================

/**
 * 数据源健康状态表 — 四源数据可用性实时监控
 */
export const dataSourceHealth = pgTable('data_source_health', {
  id: serial('id').primaryKey(),
  source: varchar('source', { length: 30 }).notNull(),          // ozon_api / aliexpress / customs_1688 / plugin

  status: varchar('status', { length: 20 }).notNull(),          // healthy / degraded / down
  lastCheckAt: timestamp('last_check_at').notNull(),
  lastSuccessAt: timestamp('last_success_at'),
  responseTime: integer('response_time'),                       // 最近一次响应时间(ms)
  errorRate: decimal('error_rate', { precision: 5, scale: 2 }), // 近1小时错误率%
  errorMessage: text('error_message'),

  // 端点级健康明细
  metadata: jsonb('metadata'),  // { endpoints: { '/v2/category/tree': { status: 'healthy', avgTime: 120 }, ... } }

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  uniqueIndex('idx_data_source_health_source').on(table.source),
]);

// ============================================================================
// 七、选品历史复盘 [V2新增表]
// D-025: 选品历史复盘一期实现
// ============================================================================

/**
 * 选品复盘追踪表 — 选品→上架→出单转化率
 *
 * [V2说明] 一期聚焦选品→上架转化（D-003 vs D-025矛盾处理）
 * 出单数据从现有ERP订单模块获取（系统已有订单同步能力），不依赖二期运营模块
 */
export const selectionRetrospectives = pgTable('selection_retrospectives', {
  id: serial('id').primaryKey(),
  shopId: integer('shop_id').references(() => shops.id).notNull(),
  opportunityId: integer('opportunity_id').references(() => opportunities.id),
  productCardId: integer('product_card_id').references(() => productCards.id),

  // 时间节点
  selectedAt: timestamp('selected_at'),                         // 确认选品时间
  listedAt: timestamp('listed_at'),                             // 上架成功时间
  firstOrderAt: timestamp('first_order_at'),                    // 首单时间（从订单模块获取）

  // 实际数据 vs 预测
  actualSales7d: integer('actual_sales_7d'),
  actualSales30d: integer('actual_sales_30d'),
  predictedSales7d: integer('predicted_sales_7d'),              // 对比Prophet预测
  predictedSales30d: integer('predicted_sales_30d'),

  // 准确度
  accuracyScore: decimal('accuracy_score', { precision: 5, scale: 2 }), // 预测准确度 0-100
  actualMargin: decimal('actual_margin', { precision: 5, scale: 2 }),   // 实际利润率%

  // AI推荐等级 vs 实际表现
  grade: varchar('grade', { length: 1 }),                       // AI推荐时的等级 A/B/C/D
  actualPerformance: varchar('actual_performance', { length: 20 }), // star / average / poor — 实际表现

  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index('idx_retrospectives_shop_id').on(table.shopId),
  index('idx_retrospectives_grade').on(table.grade),
  index('idx_retrospectives_product_card').on(table.productCardId),
]);

/** 复盘表关系 */
export const selectionRetrospectivesRelations = relations(selectionRetrospectives, ({ one }) => ({
  shop: one(shops, { fields: [selectionRetrospectives.shopId], references: [shops.id] }),
  opportunity: one(opportunities, { fields: [selectionRetrospectives.opportunityId], references: [opportunities.id] }),
  productCard: one(productCards, { fields: [selectionRetrospectives.productCardId], references: [productCards.id] }),
}));

// ============================================================================
// 八、通知系统 [V2新增表]
// ============================================================================

/**
 * 通知表 — 站内通知推送记录
 * 支持政策变更通知、算法参数刷新确认、流程异常提醒等
 */
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id', { length: 50 }).notNull(),         // 接收人
  type: varchar('type', { length: 30 }).notNull(),              // policy_change / algorithm_refresh / listing_status / data_source_alert
  severity: varchar('severity', { length: 10 }).notNull(),      // critical / warning / info

  title: varchar('title', { length: 200 }).notNull(),
  body: text('body'),

  // 关联实体
  relatedEntityType: varchar('related_entity_type', { length: 30 }), // policy_change_event / product_card / listing_task
  relatedEntityId: integer('related_entity_id'),

  // 已读状态
  isRead: boolean('is_read').default(false),
  readAt: timestamp('read_at'),

  // 操作按钮（如"确认并刷新参数"）
  actionType: varchar('action_type', { length: 30 }),           // acknowledge / refresh_params / retry / navigate
  actionData: jsonb('action_data'),                             // 操作所需数据
  actionCompletedAt: timestamp('action_completed_at'),

  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index('idx_notifications_user_id').on(table.userId),
  index('idx_notifications_is_read').on(table.isRead),
  index('idx_notifications_type').on(table.type),
  index('idx_notifications_created').on(table.createdAt),
]);

/** 通知关系 */
export const notificationsRelations = relations(notifications, ({ one }) => ({
  policyChangeEvent: one(policyChangeEvents, {
    fields: [notifications.relatedEntityId],
    references: [policyChangeEvents.id],
    relationName: 'notificationPolicyEvent',
  }),
}));

// ============================================================================
// 九、Ozon平台知识库
// D-019: 政策实时感知 + 规则自动刷新
// ============================================================================

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
  index('idx_knowledge_synced_at').on(table.syncedAt),
]);

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
  index('idx_policy_change_created').on(table.createdAt),
  index('idx_policy_change_acknowledged').on(table.acknowledgedAt),
]);

// ============================================================================
// 十、同步调度配置表
// ============================================================================

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

// ============================================================================
// 十一、类型导出
// ============================================================================

export type Shop = typeof shops.$inferSelect;
export type NewShop = typeof shops.$inferInsert;
export type EacConfig = typeof eacConfig.$inferSelect;
export type Opportunity = typeof opportunities.$inferSelect;
export type NewOpportunity = typeof opportunities.$inferInsert;
export type ProductCard = typeof productCards.$inferSelect;
export type NewProductCard = typeof productCards.$inferInsert;
export type ProductVariant = typeof productVariants.$inferSelect;
export type NewProductVariant = typeof productVariants.$inferInsert;
export type ImageSet = typeof imageSets.$inferSelect;
export type NewImageSet = typeof imageSets.$inferInsert;
export type ImageTemplate = typeof imageTemplates.$inferSelect;
export type ListingTask = typeof listingTasks.$inferSelect;
export type NewListingTask = typeof listingTasks.$inferInsert;
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
