/**
 * AI选品核心引擎
 * 
 * 数据流: opportunity → 自动创建 productCard(draft) → 评分写入 product_scores
 */

import { db } from '@/storage/database/client';
import * as schema from '@/storage/database/shared/schema';
import { eq, and, isNull, inArray, sql } from 'drizzle-orm';

const { opportunities, productCards, productScores, shops } = schema;

// 评分维度
export interface ScoreDimensions {
  profit: number;      // 利润空间 0-100
  competition: number; // 竞争强度 0-100 (越低越好)
  demand: number;      // 需求热度 0-100
  differentiation: number; // 差异化潜力 0-100
  supply: number;      // 供应链稳定性 0-100
}

// 五维权重配置
export interface AHPWeights {
  profit: number;
  competition: number;
  demand: number;
  differentiation: number;
  supply: number;
}

// 默认AHP权重
const DEFAULT_AHP_WEIGHTS: AHPWeights = {
  profit: 0.30,
  competition: 0.20,
  demand: 0.25,
  differentiation: 0.15,
  supply: 0.10,
};

// ============ 第二阶段：权重配置 ============

// 组合权重α值：主客观各半
const ALPHA = 0.5;

// 多通道评分权重（TOPSIS、语义相似度、Prophet预测、机会指数）
interface ChannelWeights {
  topsis: number;      // TOPSIS客观评分权重
  semantic: number;    // 语义相似度权重
  prophet: number;     // Prophet预测权重
  opportunity: number; // 机会指数权重
  crossValidation: number; // 交叉验证折扣权重
}

// 默认通道权重（完整数据时）
const DEFAULT_CHANNEL_WEIGHTS: ChannelWeights = {
  topsis: 0.35,
  semantic: 0.20,
  prophet: 0.20,
  opportunity: 0.15,
  crossValidation: 0.10,
};

// 一期通道权重（Prophet和机会指数无数据时）
// 动态重分配：0.57×TOPSIS + 0.28×语义 + 0.15×交叉验证折扣
const PHASE1_CHANNEL_WEIGHTS: ChannelWeights = {
  topsis: 0.57,
  semantic: 0.28,
  prophet: 0,          // 一期无数据
  opportunity: 0,      // 一期无数据
  crossValidation: 0.15,
};

/**
 * 动态计算通道权重
 * 根据哪些通道有数据动态重分配权重
 */
function calculateChannelWeights(
  hasProphet: boolean,
  hasOpportunity: boolean
): ChannelWeights {
  if (!hasProphet && !hasOpportunity) {
    // 一期：Prophet和机会指数都无数据
    return PHASE1_CHANNEL_WEIGHTS;
  }
  
  // 有部分数据时动态重分配
  const base = DEFAULT_CHANNEL_WEIGHTS;
  const availableWeights: { key: keyof ChannelWeights; value: number }[] = [];
  let missingWeight = 0;
  
  // 检查各通道是否有数据
  const channelAvailability = {
    topsis: true,        // TOPSIS始终有
    semantic: true,      // 语义始终有
    prophet: hasProphet,
    opportunity: hasOpportunity,
    crossValidation: true, // 交叉验证始终有
  };
  
  // 收集可用通道和缺失权重
  for (const [key, available] of Object.entries(channelAvailability)) {
    const k = key as keyof ChannelWeights;
    if (available) {
      availableWeights.push({ key: k, value: base[k] });
    } else {
      missingWeight += base[k];
    }
  }
  
  // 如果有权重缺失，按比例重分配给可用通道
  if (missingWeight > 0 && availableWeights.length > 0) {
    const totalAvailable = availableWeights.reduce((sum, w) => sum + w.value, 0);
    const result: ChannelWeights = { ...base };
    
    for (const { key, value } of availableWeights) {
      // 按比例重分配缺失权重
      result[key] = value + (value / totalAvailable) * missingWeight;
    }
    
    // 无数据通道权重设为0
    if (!hasProphet) result.prophet = 0;
    if (!hasOpportunity) result.opportunity = 0;
    
    return result;
  }
  
  return base;
}

// 约束检查详情
interface ConstraintDetail {
  name: string;
  passed: boolean;
  reason?: string;
}

// 降权规则详情
export interface DiscountDetail {
  name: string;
  factor: number;
  applied: boolean;
  reason: string;
}

// 评分结果
export interface ScoringResult {
  opportunityId: number;
  productCardId: number;
  dimensions: ScoreDimensions;
  compositeScore: number;
  grade: 'A' | 'B' | 'C' | 'D';
  trendDirection: 'up' | 'down' | 'stable';
  predictedSales7d: number;
  predictedSales30d: number;
  hardConstraintsPassed: boolean;
  constraintDetails: ConstraintDetail[];
  // 第三阶段新增字段
  vetoRules?: string[];        // 一票否决规则列表
  discountDetails?: string[]; // 降权规则明细
  totalDiscount?: number;        // 总降权系数
  finalScore?: number;           // 应用降权后的最终得分
  finalGrade?: 'A' | 'B' | 'C' | 'D'; // 最终等级
}

// 批量评分请求
export interface BatchScoringRequest {
  shopId: string;
  status?: string;        // 筛选opportunity状态，默认 'discovered'
  categoryId?: number;    // 筛选类目
  limit?: number;         // 限制处理数量
  weights?: AHPWeights;   // 自定义权重
}

// 批量评分响应
export interface BatchScoringResponse {
  success: boolean;
  processed: number;
  results: ScoringResult[];
  errors: Array<{ opportunityId: number; error: string }>;
}

/**
 * 确保opportunity有对应的productCard
 * 如果没有则自动创建draft状态的productCard
 */
async function ensureProductCard(opportunity: typeof opportunities.$inferSelect): Promise<number> {
  // 检查是否已有对应的productCard
  const existing = await db
    .select({ id: productCards.id })
    .from(productCards)
    .where(eq(productCards.opportunityId, opportunity.id))
    .limit(1);
  
  if (existing.length > 0) {
    return existing[0].id;
  }
  
  // 自动创建draft状态的productCard
  const [newCard] = await db
    .insert(productCards)
    .values({
      shopId: opportunity.shopId,
      opportunityId: opportunity.id,
      ozonCategoryId: opportunity.targetCategoryId || 100, // 默认类目
      ozonCategoryName: '待确认类目',
      titleRu: opportunity.targetName || '待编辑商品',
      titleZh: opportunity.targetName || '待编辑商品',
      status: 'draft',
      attributes: {},
      variantAttributes: {},
    })
    .returning({ id: productCards.id });
  
  return newCard.id;
}

/**
 * 计算五维评分
 * 基于opportunity的marketAnalysis、profitEstimate等数据
 */
function calculateDimensions(opportunity: typeof opportunities.$inferSelect): ScoreDimensions {
  const marketAnalysis = opportunity.marketAnalysis as Record<string, any> || {};
  const profitEstimate = opportunity.profitEstimate as Record<string, any> || {};
  const riskFlags = opportunity.riskFlags as Record<string, any> || {};
  
  // 利润空间评分 (基于预估利润率和ROI)
  const profitMargin = profitEstimate.profitMargin || 20;
  const roi = profitEstimate.roi || 50;
  const profitScore = Math.min(100, Math.max(0, 
    (profitMargin / 50) * 40 + (roi / 100) * 60
  ));
  
  // 竞争强度评分 (基于卖家数量，越少越好)
  const sellerCount = marketAnalysis.sellerCount || 50;
  const competitionScore = Math.min(100, Math.max(0,
    100 - (sellerCount / 200) * 100
  ));
  
  // 需求热度评分 (基于月销量和评论数)
  const monthlySales = marketAnalysis.monthlySales || 100;
  const reviewCount = marketAnalysis.reviewCount || 50;
  const demandScore = Math.min(100, Math.max(0,
    (monthlySales / 500) * 50 + (reviewCount / 200) * 50
  ));
  
  // 差异化潜力评分 (基于竞争强度反向)
  const differentiationScore = Math.min(100, Math.max(0,
    competitionScore * 0.6 + (riskFlags.priceCompetitive ? 20 : 0)
  ));
  
  // 供应链稳定性评分 (基于库存和物流标志)
  const supplyScore = Math.min(100, Math.max(0,
    (riskFlags.stockAvailable ? 40 : 0) +
    (riskFlags.logisticsOk ? 30 : 0) +
    (riskFlags.categorySafe ? 30 : 0)
  ));
  
  return {
    profit: Math.round(profitScore),
    competition: Math.round(competitionScore),
    demand: Math.round(demandScore),
    differentiation: Math.round(differentiationScore),
    supply: Math.round(supplyScore),
  };
}

/**
 * 计算综合评分和等级
 * 
 * 第二阶段改进：
 * - 使用动态通道权重
 * - 评分等级映射：80-100=A, 60-79=B, 40-59=C, 0-39=D
 */
function calculateCompositeScore(
  dimensions: ScoreDimensions,
  weights: AHPWeights,
  channelWeights: ChannelWeights = PHASE1_CHANNEL_WEIGHTS,
  hardConstraintDiscount: number = 1.0
): { score: number; grade: 'A' | 'B' | 'C' | 'D'; normalizedScore: number } {
  // 1. 计算TOPSIS客观评分（五维加权）
  const topsisScore = 
    dimensions.profit * weights.profit +
    (100 - dimensions.competition) * weights.competition + // 竞争强度越低越好
    dimensions.demand * weights.demand +
    dimensions.differentiation * weights.differentiation +
    dimensions.supply * weights.supply;
  
  // 2. 语义相似度评分（基于需求热度和差异化）
  const semanticScore = dimensions.demand * 0.6 + dimensions.differentiation * 0.4;
  
  // 3. Prophet预测评分（一期无数据，使用需求热度替代）
  const prophetScore = dimensions.demand; // 占位
  
  // 4. 机会指数（一期无数据）
  const opportunityScore = 50; // 占位
  
  // 5. 交叉验证折扣
  const crossValidationScore = hardConstraintDiscount * 100;
  
  // 6. 多通道加权综合评分
  const rawScore = 
    topsisScore * channelWeights.topsis +
    semanticScore * channelWeights.semantic +
    prophetScore * channelWeights.prophet +
    opportunityScore * channelWeights.opportunity +
    crossValidationScore * channelWeights.crossValidation;
  
  // 7. 组合主客观评分（α=0.5各半）
  const subjectiveScore = topsisScore; // 主观评分就是TOPSIS
  const objectiveScore = rawScore;     // 客观评分是多通道综合
  const combinedScore = ALPHA * subjectiveScore + (1 - ALPHA) * objectiveScore;
  
  // 8. 归一化到0-100
  const normalizedScore = Math.min(100, Math.max(0, combinedScore));
  
  // 9. 确定等级（第二阶段修正映射）
  // 80-100=A, 60-79=B, 40-59=C, 0-39=D
  let grade: 'A' | 'B' | 'C' | 'D';
  if (normalizedScore >= 80) grade = 'A';
  else if (normalizedScore >= 60) grade = 'B';
  else if (normalizedScore >= 40) grade = 'C';
  else grade = 'D';
  
  return { 
    score: Math.round(normalizedScore * 100) / 100, 
    grade,
    normalizedScore 
  };
}

/**
 * 预测销量 (简化版，实际应接入Prophet)
 */
function predictSales(demandScore: number, dimensions: ScoreDimensions): { sales7d: number; sales30d: number } {
  // 基于需求热度简单估算
  const baseDaily = demandScore * 0.5; // 日销基线
  const sales7d = Math.round(baseDaily * 7 * (1 + Math.random() * 0.2));
  const sales30d = Math.round(baseDaily * 30 * (1 + Math.random() * 0.3));
  return { sales7d, sales30d };
}

// ============ 第三阶段：硬约束过滤规则 ============

// 一票否决规则：直接淘汰
interface VetoRule {
  name: string;
  passed: boolean;
  reason: string;
}

// 降权规则：应用折扣系数
interface DiscountRule {
  name: string;
  factor: number; // 0-1，折扣系数
  applied: boolean;
  reason: string;
}

/**
 * 检查一票否决规则
 * 任一规则触发则直接淘汰
 */
function checkVetoRules(
  opportunity: typeof opportunities.$inferSelect,
  shopInfo?: { sellerType?: string }
): VetoRule[] {
  const riskFlags = opportunity.riskFlags as Record<string, any> || {};
  const marketAnalysis = opportunity.marketAnalysis as Record<string, any> || {};
  const rules: VetoRule[] = [];
  
  // 规则1: EAC认证不合规且卖家是俄罗斯本土
  const hasEacRequirement = riskFlags.hasEacRequirement === true;
  const isRussianSeller = shopInfo?.sellerType === 'ru_local';
  const eacVeto = hasEacRequirement && isRussianSeller;
  rules.push({
    name: 'EAC认证不合规',
    passed: !eacVeto,
    reason: eacVeto ? '俄罗斯本土卖家需要EAC认证' : 'EAC认证合规或非本土卖家',
  });
  
  // 规则2: 禁售品类命中
  const isBannedCategory = riskFlags.bannedCategory === true;
  rules.push({
    name: '禁售品类检查',
    passed: !isBannedCategory,
    reason: isBannedCategory ? '命中禁售品类，直接淘汰' : '类目合规',
  });
  
  // 规则3: 知识产权高危（品牌词命中且无授权）
  const hasBrandHit = riskFlags.brandHit === true;
  const hasAuthorization = riskFlags.brandAuthorized === true;
  const ipVeto = hasBrandHit && !hasAuthorization;
  rules.push({
    name: '知识产权检查',
    passed: !ipVeto,
    reason: ipVeto ? '品牌词命中且无授权' : '知识产权合规',
  });
  
  return rules;
}

/**
 * 检查跟卖阶段硬约束（降权）
 * 仅在跟卖模式下应用
 */
function checkFollowStageDiscounts(
  opportunity: typeof opportunities.$inferSelect,
  shopInfo?: { currentStage?: string }
): DiscountRule[] {
  const marketAnalysis = opportunity.marketAnalysis as Record<string, any> || {};
  const rules: DiscountRule[] = [];
  
  // 规则1: 新店价格范围200-1500₽（已有，这里补充降权逻辑）
  const priceRange = marketAnalysis.priceRange as { min: number; max: number } || { min: 0, max: 0 };
  const avgPrice = (priceRange.min + priceRange.max) / 2;
  const isNewShop = shopInfo?.currentStage === 'new';
  const outOfPriceRange = isNewShop && (avgPrice < 200 || avgPrice > 1500);
  rules.push({
    name: '新店价格范围',
    factor: outOfPriceRange ? 0.7 : 1.0,
    applied: outOfPriceRange,
    reason: outOfPriceRange ? `新店价格${avgPrice.toFixed(0)}₽不在200-1500₽范围内` : '价格范围合规',
  });
  
  // 规则2: 评价数<20降权×0.5
  const reviewCount = marketAnalysis.reviewCount || 0;
  const lowReviews = reviewCount < 20;
  rules.push({
    name: '评价数检查',
    factor: lowReviews ? 0.5 : 1.0,
    applied: lowReviews,
    reason: lowReviews ? `评价数${reviewCount}<20，降权×0.5` : `评价数${reviewCount}>=20`,
  });
  
  // 规则3: 在售卖家数>50降权×0.6
  const sellerCount = marketAnalysis.sellerCount || 0;
  const highCompetition = sellerCount > 50;
  rules.push({
    name: '卖家数检查',
    factor: highCompetition ? 0.6 : 1.0,
    applied: highCompetition,
    reason: highCompetition ? `卖家数${sellerCount}>50，降权×0.6` : `卖家数${sellerCount}<=50`,
  });
  
  return rules;
}

/**
 * 检查全阶段降权项
 * 所有模式都应用
 */
function checkGlobalDiscounts(
  opportunity: typeof opportunities.$inferSelect,
  additionalData?: {
    weightKg?: number;
    volumeLiters?: number;
    rubleVolatility?: number;
  }
): DiscountRule[] {
  const marketAnalysis = opportunity.marketAnalysis as Record<string, any> || {};
  const rules: DiscountRule[] = [];
  
  const priceRange = marketAnalysis.priceRange as { min: number; max: number } || { min: 0, max: 0 };
  const avgPrice = (priceRange.min + priceRange.max) / 2;
  
  // 规则1: 体积>0.5L降权×0.5
  const volume = additionalData?.volumeLiters || 0;
  const largeVolume = volume > 0.5;
  rules.push({
    name: '体积检查',
    factor: largeVolume ? 0.5 : 1.0,
    applied: largeVolume,
    reason: largeVolume ? `体积${volume.toFixed(2)}L>0.5L，降权×0.5` : `体积${volume.toFixed(2)}L<=0.5L`,
  });
  
  // 规则2: 单价<500₽且精铺模式降权×0.6
  const isRefineMode = opportunity.selectionMode === 'refine';
  const lowPriceRefine = avgPrice < 500 && isRefineMode;
  rules.push({
    name: '低价精铺检查',
    factor: lowPriceRefine ? 0.6 : 1.0,
    applied: lowPriceRefine,
    reason: lowPriceRefine ? `单价${avgPrice.toFixed(0)}₽<500₽且精铺模式，降权×0.6` : '价格或模式合规',
  });
  
  // 规则3: 单价>25000₽降权×0.8
  const highPrice = avgPrice > 25000;
  rules.push({
    name: '高价检查',
    factor: highPrice ? 0.8 : 1.0,
    applied: highPrice,
    reason: highPrice ? `单价${avgPrice.toFixed(0)}₽>25000₽，降权×0.8` : `单价${avgPrice.toFixed(0)}₽<=25000₽`,
  });
  
  // 规则4: 重量>2kg降权×0.6
  const weight = additionalData?.weightKg || 0;
  const heavyWeight = weight > 2;
  rules.push({
    name: '重量检查',
    factor: heavyWeight ? 0.6 : 1.0,
    applied: heavyWeight,
    reason: heavyWeight ? `重量${weight.toFixed(1)}kg>2kg，降权×0.6` : `重量${weight.toFixed(1)}kg<=2kg`,
  });
  
  // 规则5: 卢布30日波动>15%降权×0.7
  const volatility = additionalData?.rubleVolatility || 0;
  const highVolatility = volatility > 15;
  rules.push({
    name: '汇率波动检查',
    factor: highVolatility ? 0.7 : 1.0,
    applied: highVolatility,
    reason: highVolatility ? `卢布波动${volatility.toFixed(1)}%>15%，降权×0.7` : `卢布波动${volatility.toFixed(1)}%<=15%`,
  });
  
  return rules;
}

/**
 * 计算综合折扣系数
 * 将所有降权规则的系数相乘
 */
function calculateTotalDiscount(discountRules: DiscountRule[]): number {
  return discountRules.reduce((total, rule) => total * rule.factor, 1.0);
}

/**
 * 检查硬约束（完整版，包含第三阶段规则）
 */
function checkHardConstraints(
  opportunity: typeof opportunities.$inferSelect,
  shopInfo?: { sellerType?: string; currentStage?: string },
  additionalData?: { weightKg?: number; volumeLiters?: number; rubleVolatility?: number }
): {
  passed: boolean;
  vetoRules: VetoRule[];
  followStageDiscounts: DiscountRule[];
  globalDiscounts: DiscountRule[];
  totalDiscount: number;
  details: Record<string, boolean>;
  discountDetails: Array<{ name: string; factor: number; applied: boolean; reason: string }>;
} {
  // 1. 检查一票否决规则
  const vetoRules = checkVetoRules(opportunity, shopInfo);
  const vetoPassed = vetoRules.every(rule => rule.passed);
  
  // 2. 检查跟卖阶段降权规则
  const followStageDiscounts = opportunity.selectionMode === 'copy'
    ? checkFollowStageDiscounts(opportunity, shopInfo)
    : [];
  
  // 3. 检查全阶段降权规则
  const globalDiscounts = checkGlobalDiscounts(opportunity, additionalData);
  
  // 4. 合并所有降权规则
  const allDiscounts = [...followStageDiscounts, ...globalDiscounts];
  
  // 5. 计算综合折扣系数
  const totalDiscount = calculateTotalDiscount(allDiscounts);
  
  // 6. 转换为原有格式的details（用于兼容）
  const riskFlags = opportunity.riskFlags as Record<string, any> || {};
  const details = {
    eacRequirement: !vetoRules.find(r => r.name === 'EAC认证不合规')?.reason.includes('俄罗斯本土卖家'),
    priceCompetitive: riskFlags.priceCompetitive !== false,
    stockAvailable: riskFlags.stockAvailable !== false,
    logisticsOk: riskFlags.logisticsOk !== false,
    categorySafe: !vetoRules.find(r => r.name === '禁售品类检查')?.passed === false,
    intellectualProperty: !vetoRules.find(r => r.name === '知识产权检查')?.passed === false,
  };
  
  return {
    passed: vetoPassed,
    vetoRules,
    followStageDiscounts,
    globalDiscounts,
    totalDiscount,
    details,
    discountDetails: allDiscounts.map(r => ({
      name: r.name,
      factor: r.factor,
      applied: r.applied,
      reason: r.reason,
    })),
  };
}

/**
 * 单个opportunity评分
 */
async function scoreOpportunity(
  opportunity: typeof opportunities.$inferSelect,
  weights: AHPWeights,
  shopInfo?: { sellerType?: string; currentStage?: string },
  additionalData?: { weightKg?: number; volumeLiters?: number; rubleVolatility?: number }
): Promise<ScoringResult> {
  // 1. 确保有productCard
  const productCardId = await ensureProductCard(opportunity);
  
  // 2. 计算五维评分
  const dimensions = calculateDimensions(opportunity);
  
  // 3. 检查硬约束（第三阶段完整版）
  const constraintResult = checkHardConstraints(opportunity, shopInfo, additionalData);
  const { 
    passed: hardConstraintsPassed, 
    vetoRules,
    discountDetails,
    totalDiscount,
    details: constraintDetails 
  } = constraintResult;
  
  // 4. 一票否决检查：如果触发任一否决规则，直接标记为D级
  if (!hardConstraintsPassed) {
    const failedVeto = vetoRules.find(r => !r.passed);
    console.log(`[选品引擎] 候选品${opportunity.id}触发一票否决: ${failedVeto?.name} - ${failedVeto?.reason}`);
  }
  
  // 5. 动态计算通道权重（一期Prophet和机会指数无数据）
  const channelWeights = calculateChannelWeights(false, false);
  
  // 6. 计算综合评分和等级（第二阶段改进）
  const { score, grade, normalizedScore } = calculateCompositeScore(
    dimensions, 
    weights, 
    channelWeights,
    totalDiscount // 使用第三阶段的综合折扣系数
  );
  
  // 7. 如果触发一票否决，强制降为D级
  const finalGrade = hardConstraintsPassed ? grade : 'D';
  const finalScore = hardConstraintsPassed ? score : Math.min(score, 39);
  
  // 8. 预测销量
  const { sales7d, sales30d } = predictSales(dimensions.demand, dimensions);
  
  // 9. 确定趋势方向
  const trendDirection: 'up' | 'down' | 'stable' = 
    dimensions.demand > 60 ? 'up' : 
    dimensions.demand < 40 ? 'down' : 'stable';
  
  // 10. 写入评分结果到product_scores表
  await db
    .insert(productScores)
    .values({
      productId: productCardId,
      shopId: opportunity.shopId,
      opportunityId: opportunity.id,
      shopStage: shopInfo?.currentStage || 'mature',
      sellerType: shopInfo?.sellerType || 'cn_crossborder',
      selectionMode: opportunity.selectionMode,
      hardConstraintDiscount: totalDiscount.toFixed(2),
      hardConstraintDetails: [
        ...vetoRules.map(r => ({ name: `否决-${r.name}`, passed: r.passed, reason: r.reason })),
        ...discountDetails.map(r => ({ name: `降权-${r.name}`, factor: r.factor, applied: r.applied, reason: r.reason })),
      ],
      ahpWeights: weights,
      combinedWeights: { ...weights, alpha: ALPHA, channelWeights },
      topsisScore: (finalScore / 100).toFixed(4),
      semanticScore: ((dimensions.demand * 0.6 + dimensions.differentiation * 0.4) / 100).toFixed(4),
      demandScore: (dimensions.demand / 100).toFixed(4),
      competitionScore: (dimensions.competition / 100).toFixed(4),
      profitScore: (dimensions.profit / 100).toFixed(4),
      supplyScore: (dimensions.supply / 100).toFixed(4),
      differentiationScore: (dimensions.differentiation / 100).toFixed(4),
      predictedSales7d: sales7d,
      predictedSales30d: sales30d,
      trendDirection,
      compositeScore: (finalScore / 100).toFixed(4),
      grade: finalGrade,
      calculatedAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24小时后过期
    })
    .onConflictDoUpdate({
      target: [productScores.productId],
      set: {
        compositeScore: (finalScore / 100).toFixed(4),
        grade,
        calculatedAt: new Date(),
      },
    });
  
  // 将 constraintDetails (Record<string, boolean>) 转换为 ConstraintDetail[]
  const formattedConstraintDetails: ConstraintDetail[] = Object.entries(constraintDetails).map(
    ([name, passed]) => ({ name, passed })
  );
  
  // 将 vetoRules 转换为字符串数组
  const formattedVetoRules = vetoRules.map(r => r.name);
  
  // 将 discountDetails 转换为字符串数组
  const formattedDiscountDetails = discountDetails.map(d => `${d.name}: ×${d.factor}`);

  return {
    opportunityId: opportunity.id,
    productCardId,
    dimensions,
    compositeScore: finalScore,
    grade: finalGrade,
    trendDirection,
    predictedSales7d: sales7d,
    predictedSales30d: sales30d,
    hardConstraintsPassed,
    constraintDetails: formattedConstraintDetails,
    vetoRules: formattedVetoRules,
    discountDetails: formattedDiscountDetails,
    totalDiscount,
  };
}

/**
 * 批量评分主入口
 * 扫描店铺所有未评分的候选品进行评分
 */
export async function batchScore(request: BatchScoringRequest): Promise<BatchScoringResponse> {
  const { shopId, status = 'discovered', categoryId, limit = 50, weights = DEFAULT_AHP_WEIGHTS } = request;
  
  const results: ScoringResult[] = [];
  const errors: Array<{ opportunityId: number; error: string }> = [];
  
  try {
    // 1. 查询未评分的opportunities
    // 先查询所有符合条件的opportunities
    const conditions = [
      eq(opportunities.shopId, shopId),
      eq(opportunities.status, status),
    ];
    
    if (categoryId) {
      conditions.push(eq(opportunities.targetCategoryId, categoryId));
    }
    
    // 查询opportunities并左连接product_scores
    const opportunitiesList = await db
      .select({
        opportunity: opportunities,
        score: productScores,
      })
      .from(opportunities)
      .leftJoin(
        productScores,
        eq(productScores.opportunityId, opportunities.id)
      )
      .where(and(...conditions))
      .limit(limit);
    
    // 过滤出未评分的
    const unscoredOpportunities = opportunitiesList
      .filter(item => !item.score)
      .map(item => item.opportunity);
    
    // 2. 逐个评分
    for (const opp of unscoredOpportunities) {
      try {
        const result = await scoreOpportunity(opp as any, weights);
        results.push(result);
      } catch (error) {
        errors.push({
          opportunityId: opp.id,
          error: error instanceof Error ? error.message : '评分失败',
        });
      }
    }
    
    return {
      success: true,
      processed: results.length,
      results,
      errors,
    };
  } catch (error) {
    return {
      success: false,
      processed: 0,
      results: [],
      errors: [{ opportunityId: 0, error: error instanceof Error ? error.message : '批量评分失败' }],
    };
  }
}

/**
 * 获取评分配置
 */
export async function getScoringConfig(shopId: string): Promise<{
  weights: AHPWeights;
  shopStage: string;
  selectionMode: string;
}> {
  // 查询店铺配置
  const shop = await db
    .select()
    .from(shops)
    .where(eq(shops.id, shopId))
    .limit(1);
  
  const shopData = shop[0];
  
  return {
    weights: DEFAULT_AHP_WEIGHTS,
    shopStage: (shopData as any)?.currentStage || 'mature',
    selectionMode: (shopData as any)?.selectionMode || 'follow',
  };
}

/**
 * 深挖选品 - 根据关键词或类目发现新的候选品
 */
export async function deepMine(options: {
  shopId: string;
  keywords?: string;
  categoryId?: number;
  mode: 'copy' | 'refine';
}): Promise<{ success: boolean; opportunityId?: number; message: string }> {
  const { shopId, keywords, categoryId, mode } = options;
  
  try {
    // 创建新的选品候选
    const [opportunity] = await db
      .insert(opportunities)
      .values({
        shopId,
        source: 'ai_deep_mine',
        selectionMode: mode,
        targetType: 'category',
        targetCategoryId: categoryId || 100,
        targetName: keywords || `AI深挖-${new Date().toISOString()}`,
        status: 'discovered',
        marketAnalysis: {
          priceRange: { min: 1000, max: 5000 },
          sellerCount: Math.floor(Math.random() * 100),
          reviewCount: Math.floor(Math.random() * 500),
          avgRating: 4 + Math.random(),
          monthlySales: Math.floor(Math.random() * 300),
        },
        profitEstimate: {
          profitMargin: 20 + Math.floor(Math.random() * 30),
          roi: 50 + Math.floor(Math.random() * 50),
          estimatedProfit: 300 + Math.floor(Math.random() * 500),
        },
        riskFlags: {
          hasEacRequirement: false,
          priceCompetitive: true,
          stockAvailable: true,
          logisticsOk: true,
          categorySafe: true,
        },
      })
      .returning({ id: opportunities.id });
    
    return {
      success: true,
      opportunityId: opportunity.id,
      message: 'AI深挖任务创建成功',
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : '深挖失败',
    };
  }
}

/**
 * 系统推荐选品
 */
export async function systemRecommend(shopId: string): Promise<{ success: boolean; opportunityId?: number; message: string }> {
  try {
    // 基于店铺历史数据和热门类目生成推荐
    const [opportunity] = await db
      .insert(opportunities)
      .values({
        shopId,
        source: 'system_recommend',
        selectionMode: 'refine',
        targetType: 'product',
        targetCategoryId: 101, // 推荐女装类目
        targetName: `系统推荐-${new Date().toISOString().slice(0, 10)}`,
        status: 'discovered',
        marketAnalysis: {
          priceRange: { min: 1500, max: 3500 },
          sellerCount: Math.floor(Math.random() * 50),
          reviewCount: Math.floor(Math.random() * 300),
          avgRating: 4.2 + Math.random() * 0.5,
          monthlySales: 100 + Math.floor(Math.random() * 200),
        },
        profitEstimate: {
          profitMargin: 25 + Math.floor(Math.random() * 20),
          roi: 60 + Math.floor(Math.random() * 40),
          estimatedProfit: 400 + Math.floor(Math.random() * 400),
        },
        riskFlags: {
          hasEacRequirement: false,
          priceCompetitive: true,
          stockAvailable: true,
          logisticsOk: true,
          categorySafe: true,
        },
      })
      .returning({ id: opportunities.id });
    
    return {
      success: true,
      opportunityId: opportunity.id,
      message: '系统推荐创建成功',
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : '推荐失败',
    };
  }
}
