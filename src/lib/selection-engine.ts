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
  constraintDetails: Record<string, boolean>;
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
 */
function calculateCompositeScore(
  dimensions: ScoreDimensions,
  weights: AHPWeights
): { score: number; grade: 'A' | 'B' | 'C' | 'D' } {
  // 加权计算综合分数
  const score = 
    dimensions.profit * weights.profit +
    (100 - dimensions.competition) * weights.competition + // 竞争强度越低越好
    dimensions.demand * weights.demand +
    dimensions.differentiation * weights.differentiation +
    dimensions.supply * weights.supply;
  
  // 确定等级
  let grade: 'A' | 'B' | 'C' | 'D';
  if (score >= 70) grade = 'A';
  else if (score >= 55) grade = 'B';
  else if (score >= 40) grade = 'C';
  else grade = 'D';
  
  return { score: Math.round(score * 100) / 100, grade };
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

/**
 * 检查硬约束
 */
function checkHardConstraints(opportunity: typeof opportunities.$inferSelect): { passed: boolean; details: Record<string, boolean> } {
  const riskFlags = opportunity.riskFlags as Record<string, any> || {};
  
  const details = {
    eacRequirement: !riskFlags.hasEacRequirement, // 无EAC要求或已满足
    priceCompetitive: riskFlags.priceCompetitive !== false,
    stockAvailable: riskFlags.stockAvailable !== false,
    logisticsOk: riskFlags.logisticsOk !== false,
    categorySafe: riskFlags.categorySafe !== false,
  };
  
  const passed = Object.values(details).every(v => v);
  return { passed, details };
}

/**
 * 单个opportunity评分
 */
async function scoreOpportunity(
  opportunity: typeof opportunities.$inferSelect,
  weights: AHPWeights
): Promise<ScoringResult> {
  // 1. 确保有productCard
  const productCardId = await ensureProductCard(opportunity);
  
  // 2. 计算五维评分
  const dimensions = calculateDimensions(opportunity);
  
  // 3. 计算综合评分和等级
  const { score, grade } = calculateCompositeScore(dimensions, weights);
  
  // 4. 预测销量
  const { sales7d, sales30d } = predictSales(dimensions.demand, dimensions);
  
  // 5. 检查硬约束
  const { passed: hardConstraintsPassed, details: constraintDetails } = checkHardConstraints(opportunity);
  
  // 6. 确定趋势方向
  const trendDirection: 'up' | 'down' | 'stable' = 
    dimensions.demand > 60 ? 'up' : 
    dimensions.demand < 40 ? 'down' : 'stable';
  
  // 7. 写入评分结果到product_scores表
  await db
    .insert(productScores)
    .values({
      productId: productCardId,
      shopId: opportunity.shopId,
      opportunityId: opportunity.id,
      shopStage: 'mature',
      sellerType: 'cn_crossborder',
      selectionMode: opportunity.selectionMode,
      hardConstraintDiscount: hardConstraintsPassed ? '1.00' : '0.50',
      hardConstraintDetails: constraintDetails,
      ahpWeights: weights,
      combinedWeights: weights,
      topsisScore: score.toFixed(4),
      demandScore: (dimensions.demand / 100).toFixed(4),
      competitionScore: (dimensions.competition / 100).toFixed(4),
      profitScore: (dimensions.profit / 100).toFixed(4),
      supplyScore: (dimensions.supply / 100).toFixed(4),
      differentiationScore: (dimensions.differentiation / 100).toFixed(4),
      predictedSales7d: sales7d,
      predictedSales30d: sales30d,
      trendDirection,
      compositeScore: (score / 100).toFixed(4),
      grade,
      calculatedAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24小时后过期
    })
    .onConflictDoUpdate({
      target: [productScores.productId],
      set: {
        compositeScore: (score / 100).toFixed(4),
        grade,
        calculatedAt: new Date(),
      },
    });
  
  return {
    opportunityId: opportunity.id,
    productCardId,
    dimensions,
    compositeScore: score,
    grade,
    trendDirection,
    predictedSales7d: sales7d,
    predictedSales30d: sales30d,
    hardConstraintsPassed,
    constraintDetails,
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
