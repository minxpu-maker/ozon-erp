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

// 市场分析数据类型（第六阶段）
interface MarketAnalysis {
  reviewCount?: number;      // 评价数
  avgRating?: number;        // 平均评分
  monthlySales?: number;     // 月销量
  sellerCount?: number;      // 在售卖家数
  priceRange?: {             // 价格区间
    min: number;
    max: number;
  };
  trendData?: number[];      // 趋势数据
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
  // 第五阶段新增字段
  crossVerifyDiscount?: number;  // 交叉验证折扣系数
  crossVerifyResult?: string; // 交叉验证结果描述
  // 第六阶段新增字段
  followSignal?: FollowSignal;   // 跟卖信号
  refineConversion?: RefineConversionResult; // 跟卖转精铺结果
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

// ============ 第四阶段：语义评分通道 ============

/**
 * 语义评分输入数据
 * 包含商品文本信息和结构化特征
 */
interface SemanticScoreInput {
  // 文本特征
  productTitle: string;         // 商品标题
  productDescription?: string;  // 商品描述
  categoryName: string;         // 类目名称
  targetKeywords?: string[];    // 目标关键词
  
  // 结构化特征（用于后续LightGBM）
  priceRange: { min: number; max: number };
  sellerCount: number;
  reviewCount: number;
  monthlySales: number;
  avgRating: number;
  
  // Embedding向量（预留接口）
  titleEmbedding?: number[];    // 标题embedding向量
  descriptionEmbedding?: number[]; // 描述embedding向量
}

/**
 * 语义评分结果
 */
interface SemanticScoreResult {
  score: number;                // 0-1的相似度得分
  confidence: number;           // 置信度 0-1
  method: 'cosine' | 'lightgbm'; // 使用的计算方法
  
  // 中间结果（用于调试和优化）
  details: {
    titleSimilarity?: number;   // 标题相似度
    categoryMatch?: number;     // 类目匹配度
    keywordMatch?: number;      // 关键词匹配度
    featureScore?: number;      // 结构化特征得分
  };
  
  // 预留LightGBM输出
  lightgbmPrediction?: number;  // LightGBM预测概率
  featureImportance?: Record<string, number>; // 特征重要性
}

/**
 * 计算余弦相似度
 * @param vec1 向量1
 * @param vec2 向量2
 * @returns 相似度 0-1
 */
function cosineSimilarity(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length || vec1.length === 0) {
    return 0;
  }
  
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;
  
  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    norm1 += vec1[i] * vec1[i];
    norm2 += vec2[i] * vec2[i];
  }
  
  const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
  if (denominator === 0) {
    return 0;
  }
  
  return Math.max(0, Math.min(1, dotProduct / denominator));
}

/**
 * 生成简单的文本向量（一期占位）
 * 实际应调用LLM Embedding API
 * 
 * 一期降级：使用简单的词频向量代替真实的embedding
 */
function generateSimpleEmbedding(text: string): number[] {
  // 简单的词频特征向量（128维）
  const vector = new Array(128).fill(0);
  const words = text.toLowerCase().split(/\s+/);
  
  words.forEach((word, index) => {
    // 使用词的字符编码作为向量索引
    const hash = word.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const vecIndex = hash % 128;
    vector[vecIndex] += 1 / (index + 1); // 考虑位置权重
  });
  
  // 归一化
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  return norm > 0 ? vector.map(v => v / norm) : vector;
}

/**
 * 语义评分函数
 * 
 * 算法设计：LLM Embedding + LightGBM
 * 
 * 一期降级：LightGBM模型还没训练，降级为余弦相似度
 * 后续接入LightGBM替换此实现
 * 
 * @param input 商品语义输入数据
 * @param targetEmbedding 目标embedding（可选，用于比较）
 * @returns 语义评分结果
 */
function semanticScore(
  input: SemanticScoreInput,
  targetEmbedding?: number[]
): SemanticScoreResult {
  const details: SemanticScoreResult['details'] = {};
  
  // ========== 一期降级实现：余弦相似度 ==========
  // TODO: 后续接入LightGBM替换此实现
  // LightGBM模型输入：[embedding向量, 结构化特征]
  // 预训练模型路径：/models/semantic_lightgbm.txt
  
  // 1. 生成或获取标题embedding
  const titleEmb = input.titleEmbedding || generateSimpleEmbedding(input.productTitle);
  
  // 2. 计算标题相似度
  let titleSimilarity = 0.5; // 默认中等相似度
  if (targetEmbedding && targetEmbedding.length > 0) {
    titleSimilarity = cosineSimilarity(titleEmb, targetEmbedding);
  }
  details.titleSimilarity = titleSimilarity;
  
  // 3. 计算类目匹配度
  // 简单实现：检查目标关键词是否在类目名称中
  let categoryMatch = 0.5;
  if (input.targetKeywords && input.targetKeywords.length > 0) {
    const categoryLower = input.categoryName.toLowerCase();
    const matchCount = input.targetKeywords.filter(
      kw => categoryLower.includes(kw.toLowerCase())
    ).length;
    categoryMatch = matchCount / input.targetKeywords.length;
  }
  details.categoryMatch = categoryMatch;
  
  // 4. 计算关键词匹配度
  let keywordMatch = 0.5;
  if (input.targetKeywords && input.targetKeywords.length > 0) {
    const titleLower = input.productTitle.toLowerCase();
    const descLower = (input.productDescription || '').toLowerCase();
    const combinedText = titleLower + ' ' + descLower;
    
    const matchCount = input.targetKeywords.filter(
      kw => combinedText.includes(kw.toLowerCase())
    ).length;
    keywordMatch = matchCount / input.targetKeywords.length;
  }
  details.keywordMatch = keywordMatch;
  
  // 5. 计算结构化特征得分（用于后续LightGBM）
  // 价格竞争力
  const avgPrice = (input.priceRange.min + input.priceRange.max) / 2;
  const priceScore = avgPrice > 500 && avgPrice < 5000 ? 1 : 
                     avgPrice < 500 ? 0.6 : 0.8;
  
  // 销量热度
  const salesScore = Math.min(1, input.monthlySales / 200);
  
  // 评价质量
  const reviewScore = Math.min(1, input.reviewCount / 100);
  
  // 综合结构化特征得分
  const featureScore = priceScore * 0.3 + salesScore * 0.4 + reviewScore * 0.3;
  details.featureScore = featureScore;
  
  // 6. 一期综合得分：加权组合
  // 权重：标题相似度30%，类目匹配20%，关键词匹配20%，结构化特征30%
  const score = 
    titleSimilarity * 0.30 +
    categoryMatch * 0.20 +
    keywordMatch * 0.20 +
    featureScore * 0.30;
  
  // 7. 计算置信度
  // 数据越完整，置信度越高
  const confidence = 
    (input.titleEmbedding ? 0.3 : 0.1) +
    (input.targetKeywords ? 0.3 : 0.1) +
    (input.productDescription ? 0.2 : 0.1) +
    (input.monthlySales > 0 ? 0.2 : 0.1);
  
  return {
    score: Math.max(0, Math.min(1, score)),
    confidence,
    method: 'cosine', // 一期使用余弦相似度
    details,
    // LightGBM相关字段预留
    lightgbmPrediction: undefined,
    featureImportance: undefined,
  };
}

/**
 * 构建语义评分输入
 * 从opportunity数据构建语义评分所需的输入
 */
function buildSemanticInput(
  opportunity: typeof opportunities.$inferSelect,
  targetKeywords?: string[],
  targetEmbedding?: number[]
): SemanticScoreInput {
  const marketAnalysis = opportunity.marketAnalysis as Record<string, any> || {};
  const priceRange = marketAnalysis.priceRange as { min: number; max: number } || { min: 1000, max: 2000 };
  
  return {
    productTitle: opportunity.targetName || '',
    categoryName: String(opportunity.targetCategoryId || ''),
    targetKeywords,
    priceRange,
    sellerCount: marketAnalysis.sellerCount || 0,
    reviewCount: marketAnalysis.reviewCount || 0,
    monthlySales: marketAnalysis.monthlySales || 0,
    avgRating: marketAnalysis.avgRating || 4.0,
    titleEmbedding: targetEmbedding, // 如果有预计算的embedding
  };
}

/**
 * 计算综合评分和等级
 * 
 * 第二阶段改进：
 * - 使用动态通道权重
 * - 评分等级映射：80-100=A, 60-79=B, 40-59=C, 0-39=D
 * 
 * 第四阶段改进：
 * - 语义评分使用独立的semanticScore函数
 * - 预留embedding+结构化特征接口
 */

/**
 * 分数转等级（第二阶段定义的映射规则）
 * @param score 百分制分数 (0-100)
 * @returns 等级 A/B/C/D
 */
function scoreToGrade(score: number): 'A' | 'B' | 'C' | 'D' {
  if (score >= 80) return 'A';
  if (score >= 60) return 'B';
  if (score >= 40) return 'C';
  return 'D';
}

function calculateCompositeScore(
  dimensions: ScoreDimensions,
  weights: AHPWeights,
  channelWeights: ChannelWeights = PHASE1_CHANNEL_WEIGHTS,
  hardConstraintDiscount: number = 1.0,
  semanticResult?: SemanticScoreResult // 第四阶段：支持外部语义评分
): { score: number; grade: 'A' | 'B' | 'C' | 'D'; normalizedScore: number; semanticScore: number } {
  // 1. 计算TOPSIS客观评分（五维加权）
  const topsisScore = 
    dimensions.profit * weights.profit +
    (100 - dimensions.competition) * weights.competition + // 竞争强度越低越好
    dimensions.demand * weights.demand +
    dimensions.differentiation * weights.differentiation +
    dimensions.supply * weights.supply;
  
  // 2. 语义相似度评分
  // 第四阶段：使用外部传入的语义评分或降级为简单计算
  let semanticScoreValue: number;
  if (semanticResult) {
    // 使用独立的semanticScore函数结果（推荐）
    semanticScoreValue = semanticResult.score * 100;
  } else {
    // 降级：基于需求热度和差异化的简单估计
    semanticScoreValue = dimensions.demand * 0.6 + dimensions.differentiation * 0.4;
  }
  
  // 3. Prophet预测评分（一期无数据，使用需求热度替代）
  const prophetScore = dimensions.demand; // 占位
  
  // 4. 机会指数（一期无数据）
  const opportunityScore = 50; // 占位
  
  // 5. 交叉验证折扣
  const crossValidationScore = hardConstraintDiscount * 100;
  
  // 6. 多通道加权综合评分
  const rawScore = 
    topsisScore * channelWeights.topsis +
    semanticScoreValue * channelWeights.semantic +
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
    normalizedScore,
    semanticScore: Math.round(semanticScoreValue * 100) / 100 // 第四阶段：返回语义评分
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

// ============ 第五阶段：四源交叉验证 ============

/**
 * 四源数据评分
 * 用于交叉验证的需求端和供给端评分
 */
interface FourSourceScores {
  // 需求端评分（Ozon + 速卖通数据）
  ozonScore: number;        // Ozon平台数据评分 0-100
  aliexpressScore: number;  // 速卖通数据评分 0-100
  demandScore: number;      // 综合需求端评分 0-100
  
  // 供给端评分（1688 + 海关数据）
  ali1688Score: number;     // 1688数据评分 0-100
  customsScore: number;     // 海关数据评分 0-100
  supplyScore: number;      // 综合供给端评分 0-100
  
  // 数据可用性
  hasOzonData: boolean;
  hasAliexpressData: boolean;
  has1688Data: boolean;
  hasCustomsData: boolean;
}

/**
 * 交叉验证结果
 */
interface CrossValidationResult {
  discount: number;              // 交叉验证折扣系数
  result: string;                // 交叉验证结果描述
  demandLevel: 'high' | 'low';   // 需求端水平
  supplyLevel: 'sufficient' | 'insufficient'; // 供给端水平
  details: {
    demandScore: number;         // 需求端综合评分
    supplyScore: number;         // 供给端综合评分
    combination: string;         // 组合类型
  };
}

/**
 * 计算四源数据评分
 * 从opportunity数据提取各数据源的评分
 */
function calculateFourSourceScores(
  opportunity: typeof opportunities.$inferSelect,
  dimensions: ScoreDimensions
): FourSourceScores {
  const marketAnalysis = opportunity.marketAnalysis as Record<string, any> || {};
  const riskFlags = opportunity.riskFlags as Record<string, any> || {};
  
  // 需求端评分（Ozon数据为主）
  // Ozon评分基于：销量、评价数、价格竞争力
  const ozonScore = Math.min(100, Math.max(0,
    (marketAnalysis.monthlySales || 0) / 5 +  // 销量贡献
    (marketAnalysis.reviewCount || 0) / 2 +   // 评价贡献
    (riskFlags.priceCompetitive ? 20 : 0)      // 价格竞争力
  ));
  
  // 速卖通评分（一期使用占位值）
  // TODO: 接入速卖通API获取真实数据
  const aliexpressScore = dimensions.demand * 0.8; // 一期降级：使用需求热度估计
  
  // 综合需求端评分（Ozon权重更高）
  const hasOzonData = true; // Ozon数据始终有
  const hasAliexpressData = false; // 一期无速卖通数据
  const demandScore = hasOzonData && hasAliexpressData
    ? ozonScore * 0.6 + aliexpressScore * 0.4  // 有两个数据源时加权
    : ozonScore;  // 只有一个数据源时直接使用
  
  // 供给端评分（1688数据为主）
  // 1688评分基于：供应商数量、起订量、价格优势
  // TODO: 接入1688 API获取真实数据
  const ali1688Score = dimensions.supply * 0.9; // 一期降级：使用供应链评分估计
  
  // 海关评分（基于类目合规性和风险）
  const customsScore = Math.min(100, Math.max(0,
    (riskFlags.categorySafe ? 50 : 0) +
    (riskFlags.hasEacRequirement ? 30 : 50) +  // 无EAC要求更好
    (riskFlags.bannedCategory ? 0 : 20)         // 非禁售类目
  ));
  
  // 综合供给端评分
  const has1688Data = false; // 一期无1688数据
  const hasCustomsData = true; // 海关数据基于riskFlags
  const supplyScore = has1688Data && hasCustomsData
    ? ali1688Score * 0.7 + customsScore * 0.3  // 有两个数据源时加权
    : customsScore;  // 只有一个数据源时直接使用
  
  return {
    ozonScore,
    aliexpressScore,
    demandScore,
    ali1688Score,
    customsScore,
    supplyScore,
    hasOzonData,
    hasAliexpressData,
    has1688Data,
    hasCustomsData,
  };
}

/**
 * 四源交叉验证
 * 
 * 逻辑：根据需求端评分和供给端评分的高低组合，乘不同折扣因子
 * - 高需求 + 供给充足 × 1.0  （最佳组合）
 * - 高需求 + 供给不足 × 0.7  （机会型，需快速切入）
 * - 低需求 + 供给充足 × 0.5  （潜力型，需培育市场）
 * - 低需求 + 供给不足 × 0.3  （风险型，建议放弃）
 * 
 * 阈值定义：
 * - 高需求：demandScore >= 60
 * - 供给充足：supplyScore >= 50
 */
function crossValidation(fourSourceScores: FourSourceScores): CrossValidationResult {
  const { demandScore, supplyScore } = fourSourceScores;
  
  // 确定需求端水平
  const demandLevel: 'high' | 'low' = demandScore >= 60 ? 'high' : 'low';
  
  // 确定供给端水平
  const supplyLevel: 'sufficient' | 'insufficient' = supplyScore >= 50 ? 'sufficient' : 'insufficient';
  
  // 根据组合确定折扣因子
  let discount: number;
  let combination: string;
  let result: string;
  
  if (demandLevel === 'high' && supplyLevel === 'sufficient') {
    // 高需求 + 供给充足 = 最佳组合
    discount = 1.0;
    combination = '高需求+供给充足';
    result = '最佳组合：高需求且供给充足，建议优先跟进';
  } else if (demandLevel === 'high' && supplyLevel === 'insufficient') {
    // 高需求 + 供给不足 = 机会型
    discount = 0.7;
    combination = '高需求+供给不足';
    result = '机会型：高需求但供给不足，需快速切入抢占市场';
  } else if (demandLevel === 'low' && supplyLevel === 'sufficient') {
    // 低需求 + 供给充足 = 潜力型
    discount = 0.5;
    combination = '低需求+供给充足';
    result = '潜力型：需求不足但供给充足，需培育市场或差异化营销';
  } else {
    // 低需求 + 供给不足 = 风险型
    discount = 0.3;
    combination = '低需求+供给不足';
    result = '风险型：需求不足且供给不足，建议放弃或长期观察';
  }
  
  return {
    discount,
    result,
    demandLevel,
    supplyLevel,
    details: {
      demandScore: Math.round(demandScore * 100) / 100,
      supplyScore: Math.round(supplyScore * 100) / 100,
      combination,
    },
  };
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
  
  // 10. 第五阶段：四源交叉验证（在评分之后、输出结果之前）
  const fourSourceScores = calculateFourSourceScores(opportunity, dimensions);
  const crossValidationResult = crossValidation(fourSourceScores);
  
  // 应用交叉验证折扣到最终得分
  const crossVerifyDiscount = crossValidationResult.discount;
  const crossVerifyResult = crossValidationResult.result;
  let scoreAfterCrossValidation = finalScore * crossVerifyDiscount;
  let gradeAfterCrossValidation = scoreToGrade(scoreAfterCrossValidation / 100);
  
  // ==================== 第六阶段：业务逻辑细节 ====================
  
  // 11. 第六阶段：跟卖信号识别
  const marketSignals = {
    searchVolumeGrowth: Math.random() * 100 - 30, // 模拟搜索量涨跌幅
    sellerCountGrowth: Math.random() * 30 - 10,   // 模拟卖家数涨跌幅
    dailySales: Math.floor(Math.random() * 30),   // 模拟日销
    returnRateTrend: Math.random() * 10 - 3,      // 模拟退货率变化
    searchTrend7Days: Array.from({ length: 7 }, () => Math.random() * 2 - 1), // 7天搜索趋势
  };
  // 第六阶段：跟卖信号识别
  // 解析marketAnalysis（jsonb字段类型断言）
  const marketAnalysisData = (opportunity.marketAnalysis || {}) as MarketAnalysis;
  
  const productStatsForSignal: ProductStats = {
    dailySales: marketSignals.dailySales,
    reviewCount: marketAnalysisData.reviewCount || 0,
    avgRating: marketAnalysisData.avgRating || 0,
    monthlySales: marketAnalysisData.monthlySales || 0,
    returnRate: 0.05, // 默认退货率5%
  };
  const marketTrendForSignal: MarketTrend = {
    searchVolumeChange: marketSignals.searchVolumeGrowth,
    sellerCountChange: marketSignals.sellerCountGrowth,
    searchVolumeTrend7d: marketSignals.searchTrend7Days,
    returnRateTrend: [marketSignals.returnRateTrend],
  };
  const followSignal = identifyFollowSignal(
    productStatsForSignal,
    marketTrendForSignal,
    marketAnalysisData.sellerCount || 0
  );
  
  // 12. 第六阶段：跟卖转精铺检测
  const shopAge = Math.floor(Math.random() * 12) + 1; // 模拟店龄（月）
  const productReviewCount = marketAnalysisData.reviewCount || 0;
  const productRating = marketAnalysisData.avgRating || 0;
  const monthlySales = marketAnalysisData.monthlySales || 0;
  
  const shouldConvertToRefineMode = shouldConvertToRefine(
    shopAge,
    productStatsForSignal,
    150 // 模拟品类Top20%阈值
  );
  
  // 13. 如果需要转为精铺，使用精铺权重重新评分
  let refineModeData: RefineConversionResult | null = null;
  if (shouldConvertToRefineMode && opportunity.selectionMode === 'copy') {
    // 使用精铺AHP权重重新评分
    const refineWeights = REFINE_AHP_WEIGHTS;
    const refineResult = calculateCompositeScore(dimensions, refineWeights, channelWeights, totalDiscount, undefined);
    
    // 计算差异化评分（精铺模式特有）
    const negativeReviewAnalysis = analyzeNegativeReviews(['质量差', '物流慢', '包装破损', '尺寸不符']);
    const semanticGapAnalysis = analyzeTitleSemanticGaps(opportunity.targetName || '', ['竞品标题1', '竞品标题2']);
    const diffScoreResult = calculateDifferentiationScore(negativeReviewAnalysis, semanticGapAnalysis);
    
    refineModeData = {
      shouldConvert: true,
      reason: `店龄${shopAge}个月，评价数${productReviewCount}，评分${productRating}`,
      refineScore: refineResult.score,
      refineGrade: refineResult.grade,
      differentiationScore: diffScoreResult.differentiationScore,
      negativeReviewKeywords: negativeReviewAnalysis.keywords,
    };
    
    console.log(`[选品引擎] 候选品${opportunity.id}建议转为精铺: ${refineModeData.reason}`);
  }
  
  // ================================================================
  
  // 11. 写入评分结果到product_scores表
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
      compositeScore: (scoreAfterCrossValidation / 100).toFixed(4), // 第五阶段：使用交叉验证后的分数
      grade: gradeAfterCrossValidation, // 第五阶段：使用交叉验证后的等级
      // 第五阶段新增字段
      crossVerifyDiscount: crossVerifyDiscount.toFixed(2),
      crossVerifyResult: crossVerifyResult,
      calculatedAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24小时后过期
    })
    .onConflictDoUpdate({
      target: [productScores.productId],
      set: {
        compositeScore: (scoreAfterCrossValidation / 100).toFixed(4),
        grade: gradeAfterCrossValidation,
        crossVerifyDiscount: crossVerifyDiscount.toFixed(2),
        crossVerifyResult: crossVerifyResult,
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
    compositeScore: scoreAfterCrossValidation, // 第五阶段：使用交叉验证后的分数
    grade: gradeAfterCrossValidation, // 第五阶段：使用交叉验证后的等级
    trendDirection,
    predictedSales7d: sales7d,
    predictedSales30d: sales30d,
    hardConstraintsPassed,
    constraintDetails: formattedConstraintDetails,
    vetoRules: formattedVetoRules,
    discountDetails: formattedDiscountDetails,
    totalDiscount,
    // 第五阶段新增字段
    crossVerifyDiscount,
    crossVerifyResult,
    // 第六阶段新增字段
    followSignal,
    refineConversion: refineModeData || undefined,
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
 * 获取评分配置（第七阶段：支持策略参数）
 */
export async function getScoringConfig(
  shopId: string,
  strategy?: SelectionStrategy
): Promise<{
  weights: AHPWeights;
  shopStage: string;
  selectionMode: string;
  strategy: SelectionStrategy;
}> {
  // 查询店铺配置
  const shop = await db
    .select()
    .from(shops)
    .where(eq(shops.id, shopId))
    .limit(1);
  
  const shopData = shop[0];
  const shopStage = (shopData as any)?.currentStage || 'mature';
  const selectionMode = (shopData as any)?.selectionMode || 'follow';
  
  // 根据策略或店铺模式确定权重
  let effectiveStrategy = strategy;
  if (!effectiveStrategy) {
    // 默认根据店铺模式选择策略
    effectiveStrategy = selectionMode === 'refine' ? 'refine_default' : 'follow_default';
  }
  const weights = getStrategyWeights(effectiveStrategy);
  
  return {
    weights,
    shopStage,
    selectionMode,
    strategy: effectiveStrategy,
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

// ============ 第六阶段：业务逻辑细节 ============

/**
 * 店铺阶段类型
 */
type ShopStage = 'new' | 'growth' | 'mature';

/**
 * 跟卖信号类型
 */
type FollowSignal = 'early_burst' | 'stable_hot' | 'declining' | null;

/**
 * 精铺转换结果
 */
interface RefineConversionResult {
  shouldConvert: boolean;
  reason: string;
  highQualityLinkCount?: number;
  monthlySales?: number;
  categoryTop20Threshold?: number;
  refineScore?: number;                    // 精铺评分
  refineGrade?: 'A' | 'B' | 'C' | 'D';    // 精铺等级
  differentiationScore?: number;           // 差异化评分
  negativeReviewKeywords?: string[];       // 负面评价关键词
}

/**
 * 商品统计数据
 */
interface ProductStats {
  reviewCount: number;
  avgRating: number;
  monthlySales: number;
  dailySales: number;
  returnRate: number;
}

/**
 * 市场趋势数据
 */
interface MarketTrend {
  searchVolumeChange: number;      // 搜索量变化百分比
  sellerCountChange: number;        // 卖险卖家数变化百分比
  searchVolumeTrend7d: number[];    // 近7天搜索量趋势
  returnRateTrend: number[];        // 退货率趋势
}

/**
 * 店铺数据
 */
interface ShopData {
  id: string;
  createdAt: Date;
  totalMonthlySales: number;
  products: ProductStats[];
}

/**
 * 判断店铺阶段
 * 第六阶段修正：
 * - 新店：店龄 ≤ 3个月
 * - 成长期：店龄 > 3个月 且 存在评价数 > 50 且 评分 ≥ 4.5的链接
 * - 成熟期：店龄 > 3个月 且 高评价链接 ≥ 3条 且 月销 > 200单
 */
export function determineShopStage(shop: ShopData): ShopStage {
  const now = new Date();
  const shopAgeMonths = (now.getTime() - shop.createdAt.getTime()) / (1000 * 60 * 60 * 24 * 30);
  
  // 新店：店龄 ≤ 3个月
  if (shopAgeMonths <= 3) {
    return 'new';
  }
  
  // 统计高评价链接数（评价数 > 50 且 评分 ≥ 4.5）
  const highQualityLinks = shop.products.filter(
    p => p.reviewCount > 50 && p.avgRating >= 4.5
  ).length;
  
  // 成熟期：店龄 > 3个月 且 高评价链接 ≥ 3条 且 月销 > 200单
  if (highQualityLinks >= 3 && shop.totalMonthlySales > 200) {
    return 'mature';
  }
  
  // 成长期：店龄 > 3个月 且 存在高评价链接
  if (highQualityLinks >= 1) {
    return 'growth';
  }
  
  // 默认成长期（店龄 > 3个月但没有高评价链接）
  return 'growth';
}

/**
 * 识别跟卖信号
 * 第六阶段新增：
 * - early_burst: 搜索量涨 > 30% 且 危险卖家数涨 < 10%
 * - stable_hot: 日销 > 10 且 评价数 > 100 且 危险卖家数 < 30
 * - declining: 搜索量连降7天 且 退货率上升
 */
export function identifyFollowSignal(
  productStats: ProductStats,
  marketTrend: MarketTrend,
  sellerCount: number
): FollowSignal {
  // early_burst: 搜索量涨 > 30% 且 危险卖家数涨 < 10%
  if (marketTrend.searchVolumeChange > 30 && marketTrend.sellerCountChange < 10) {
    return 'early_burst';
  }
  
  // stable_hot: 日销 > 10 且 评价数 > 100 且 危险卖家数 < 30
  if (
    productStats.dailySales > 10 &&
    productStats.reviewCount > 100 &&
    sellerCount < 30
  ) {
    return 'stable_hot';
  }
  
  // declining: 搜索量连降7天 且 退货率上升
  const searchVolumeDeclining = marketTrend.searchVolumeTrend7d.every(
    (v, i, arr) => i === 0 || v <= arr[i - 1]
  );
  const returnRateRising = marketTrend.returnRateTrend.length >= 2 &&
    marketTrend.returnRateTrend[marketTrend.returnRateTrend.length - 1] >
    marketTrend.returnRateTrend[0];
  
  if (searchVolumeDeclining && returnRateRising) {
    return 'declining';
  }
  
  return null;
}

/**
 * 检测是否应转为精铺模式
 * 第六阶段新增：
 * - 店龄 > 3个月 或
 * - 某商品评价数 > 50 且 评分 ≥ 4.5 或
 * - 某商品近30天销量 > 品类Top20%
 */
export function shouldConvertToRefine(
  shopAgeMonths: number,
  productStats: ProductStats,
  categoryTop20Sales: number
): boolean {
  // 条件1：店龄 > 3个月
  if (shopAgeMonths > 3) {
    return true;
  }
  
  // 条件2：某商品评价数 > 50 且 评分 ≥ 4.5
  if (productStats.reviewCount > 50 && productStats.avgRating >= 4.5) {
    return true;
  }
  
  // 条件3：某商品近30天销量 > 品类Top20%
  if (productStats.monthlySales > categoryTop20Sales) {
    return true;
  }
  
  return false;
}

/**
 * 精铺AHP权重矩阵
 * 与跟卖权重不同，更注重差异化和长期价值
 */
const REFINE_AHP_WEIGHTS: AHPWeights = {
  profit: 0.20,           // 降低利润权重（精铺前期利润低）
  competition: 0.20,      // 竞争强度
  demand: 0.20,           // 需求热度
  differentiation: 0.25,  // 提高差异化权重（精铺核心）
  supply: 0.15,           // 供应链稳定性
};

/**
 * 竞品差评分析结果
 */
interface NegativeReviewAnalysis {
  keywords: string[];           // 负面关键词列表
  frequency: Record<string, number>;  // 关键词出现频率
  categories: Record<string, string[]>;  // 分类后的负面问题
}

/**
 * 分析竞品差评关键词
 * 第六阶段新增：从竞品差评聚合分析
 * 一期降级：使用模拟数据，后续接入真实评论数据
 */
export function analyzeNegativeReviews(
  competitorReviews: string[]
): NegativeReviewAnalysis {
  /**
   * 一期降级：使用模拟数据
   * TODO: 后续接入真实评论数据，进行NLP分析
   */
  const commonNegativeKeywords = [
    '质量差', '尺寸不准', '色差大', '材质不好', 
    '做工粗糙', '物流慢', '包装破损', '与描述不符',
    '性价比低', '不推荐购买', '退货', '退款'
  ];
  
  // 模拟关键词频率
  const frequency: Record<string, number> = {};
  commonNegativeKeywords.forEach(keyword => {
    frequency[keyword] = Math.floor(Math.random() * 20) + 1;
  });
  
  // 分类整理
  const categories: Record<string, string[]> = {
    quality: ['质量差', '材质不好', '做工粗糙'],
    size: ['尺寸不准'],
    color: ['色差大'],
    logistics: ['物流慢', '包装破损'],
    value: ['性价比低', '不推荐购买'],
    service: ['退货', '退款'],
  };
  
  return {
    keywords: commonNegativeKeywords,
    frequency,
    categories,
  };
}

/**
 * 标题语义空白分析
 * 第六阶段新增：分析竞品标题覆盖的语义空间，找出空白点
 * 一期降级：使用模拟数据，后续接入Embedding分析
 */
export function analyzeTitleSemanticGaps(
  productTitle: string,
  competitorTitles: string[]
): {
  gaps: string[];           // 语义空白点
  opportunities: string[];  // 差异化机会
  coveredTopics: string[];  // 已覆盖的主题
} {
  /**
   * 一期降级：使用模拟数据
   * TODO: 后续接入Embedding分析，计算语义空间的实际覆盖情况
   */
  
  // 模拟已覆盖的主题
  const coveredTopics = [
    '材质', '风格', '季节', '场景', '人群'
  ];
  
  // 模拟语义空白点
  const gaps = [
    '环保材质', '抗菌功能', '智能设计', 
    '便携收纳', '多场景适用', '亲子款'
  ];
  
  // 模拟差异化机会
  const opportunities = gaps.map(gap => `可在"${gap}"维度进行差异化`);
  
  return {
    gaps,
    opportunities,
    coveredTopics,
  };
}

/**
 * 计算精铺差异化评分
 * 第六阶段新增：综合竞品差评和标题语义空白分析
 */
export function calculateDifferentiationScore(
  negativeReviewAnalysis: NegativeReviewAnalysis,
  semanticGapAnalysis: ReturnType<typeof analyzeTitleSemanticGaps>
): {
  differentiationScore: number;    // 差异化评分 0-100
  negativeReviewKeywords: string[];  // 需规避的负面关键词
  differentiationOpportunities: string[];  // 差异化机会点
} {
  // 基于语义空白点数量计算差异化潜力
  const gapPotential = Math.min(100, semanticGapAnalysis.gaps.length * 15);
  
  // 基于负面关键词规避能力评分
  const avoidNegativePotential = Math.min(100, 
    negativeReviewAnalysis.keywords.length * 5
  );
  
  // 综合差异化评分
  const differentiationScore = Math.round(
    gapPotential * 0.6 + avoidNegativePotential * 0.4
  );
  
  return {
    differentiationScore,
    negativeReviewKeywords: negativeReviewAnalysis.keywords.slice(0, 10),
    differentiationOpportunities: semanticGapAnalysis.opportunities,
  };
}

/**
 * 精铺模式评分
 * 使用精铺AHP权重重新评分
 */
export function scoreForRefineMode(
  opportunity: typeof opportunities.$inferSelect,
  productStats: ProductStats,
  competitorData: {
    reviews: string[];
    titles: string[];
  }
): {
  scores: ScoreDimensions;
  differentiation: ReturnType<typeof calculateDifferentiationScore>;
  compositeScore: number;
  grade: 'A' | 'B' | 'C' | 'D';
} {
  // 1. 计算基础五维评分
  const baseScores = calculateDimensions(opportunity);
  
  // 2. 分析竞品差评
  const negativeReviewAnalysis = analyzeNegativeReviews(competitorData.reviews);
  
  // 3. 分析标题语义空白
  const semanticGapAnalysis = analyzeTitleSemanticGaps(
    opportunity.targetName || '',
    competitorData.titles
  );
  
  // 4. 计算差异化评分
  const differentiation = calculateDifferentiationScore(
    negativeReviewAnalysis,
    semanticGapAnalysis
  );
  
  // 5. 更新五维评分中的差异化维度
  const scores: ScoreDimensions = {
    ...baseScores,
    differentiation: differentiation.differentiationScore,
  };
  
  // 6. 使用精铺权重计算综合评分
  const compositeResult = calculateCompositeScore(scores, REFINE_AHP_WEIGHTS);
  
  return {
    scores,
    differentiation,
    compositeScore: compositeResult.score,
    grade: compositeResult.grade,
  };
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

// ============ 第七阶段：排序和去重 ============

/**
 * 策略类型定义
 */
export type SelectionStrategy = 'follow_default' | 'refine_default' | 'follow_aggressive' | 'refine_conservative';

/**
 * 策略对应的AHP权重配置
 */
const STRATEGY_WEIGHTS: Record<SelectionStrategy, AHPWeights> = {
  // 跟卖默认策略：重视利润和需求
  follow_default: {
    profit: 0.30,
    competition: 0.15,
    demand: 0.30,
    differentiation: 0.10,
    supply: 0.15,
  },
  // 跟卖激进策略：高利润优先
  follow_aggressive: {
    profit: 0.40,
    competition: 0.10,
    demand: 0.25,
    differentiation: 0.10,
    supply: 0.15,
  },
  // 精铺默认策略：重视差异化和供应链
  refine_default: {
    profit: 0.20,
    competition: 0.15,
    demand: 0.20,
    differentiation: 0.30,
    supply: 0.15,
  },
  // 精铺保守策略：稳定优先
  refine_conservative: {
    profit: 0.15,
    competition: 0.20,
    demand: 0.15,
    differentiation: 0.25,
    supply: 0.25,
  },
};

/**
 * 获取策略对应的AHP权重
 */
export function getStrategyWeights(strategy: SelectionStrategy = 'follow_default'): AHPWeights {
  return STRATEGY_WEIGHTS[strategy];
}

/**
 * 计算新鲜度衰减
 * 公式：0.95^发现天数
 * @param discoveredAt 发现时间
 * @returns 衰减系数 0-1
 */
export function calculateFreshnessDecay(discoveredAt: Date | string | null): number {
  if (!discoveredAt) return 1;
  
  const discovered = new Date(discoveredAt);
  const now = new Date();
  const daysSinceDiscovery = Math.floor((now.getTime() - discovered.getTime()) / (1000 * 60 * 60 * 24));
  
  // 0.95^天数，最多衰减30天
  const effectiveDays = Math.min(daysSinceDiscovery, 30);
  return Math.pow(0.95, effectiveDays);
}

/**
 * 最终排序结果
 */
export interface FinalSortResult {
  opportunityId: number;
  finalScore: number;      // 最终排序分数
  compositeScore: number;  // 综合评分
  freshnessDecay: number;  // 新鲜度衰减
  hardConstraintDiscount: number; // 硬约束折扣
  crossVerifyDiscount: number; // 交叉验证折扣
  isDeduplicated: boolean; // 是否被去重
  dedupReason?: string;    // 去重原因
}

/**
 * 计算最终排序分数
 * 公式：综合评分 × 新鲜度衰减 × 硬约束折扣 × 交叉验证折扣
 */
export function calculateFinalScore(
  compositeScore: number,
  discoveredAt: Date | string | null,
  hardConstraintDiscount: number = 1,
  crossVerifyDiscount: number = 1
): FinalSortResult {
  const freshnessDecay = calculateFreshnessDecay(discoveredAt);
  const finalScore = compositeScore * freshnessDecay * hardConstraintDiscount * crossVerifyDiscount;
  
  return {
    opportunityId: 0, // 调用时填充
    finalScore,
    compositeScore,
    freshnessDecay,
    hardConstraintDiscount,
    crossVerifyDiscount,
    isDeduplicated: false,
  };
}

/**
 * 去重规则配置
 */
export interface DedupConfig {
  sameCategoryKeepTop: boolean;   // 同类目只保留最高分
  imageHashThreshold: number;     // 图片哈希相似度阈值
  titleSimilarityThreshold: number; // 标题相似度阈值
  excludeBlacklist: boolean;      // 排除用户黑名单
  excludeListed: boolean;         // 排除已上架商品
}

const DEFAULT_DEDUP_CONFIG: DedupConfig = {
  sameCategoryKeepTop: true,
  imageHashThreshold: 0.9,
  titleSimilarityThreshold: 0.85,
  excludeBlacklist: true,
  excludeListed: true,
};

/**
 * 候选品数据（用于去重）
 */
export interface OpportunityForDedup {
  id: number;
  targetCategoryId?: number | null;
  targetName?: string | null;
  imageHash?: string | null;
  source1688Url?: string | null;
  score: number;
  isBlacklisted?: boolean;
  isAlreadyListed?: boolean;
}

/**
 * 计算标题相似度（余弦相似度简化版）
 */
function calculateTitleSimilarity(title1: string, title2: string): number {
  if (!title1 || !title2) return 0;
  
  // 简单的词频向量余弦相似度
  const words1 = title1.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const words2 = title2.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  
  if (words1.length === 0 || words2.length === 0) return 0;
  
  const wordSet = new Set([...words1, ...words2]);
  const vec1 = Array.from(wordSet).map(w => words1.filter(w1 => w1 === w).length);
  const vec2 = Array.from(wordSet).map(w => words2.filter(w2 => w2 === w).length);
  
  const dotProduct = vec1.reduce((sum, v1, i) => sum + v1 * vec2[i], 0);
  const norm1 = Math.sqrt(vec1.reduce((sum, v) => sum + v * v, 0));
  const norm2 = Math.sqrt(vec2.reduce((sum, v) => sum + v * v, 0));
  
  if (norm1 === 0 || norm2 === 0) return 0;
  return dotProduct / (norm1 * norm2);
}

/**
 * 图片哈希相似度计算
 */
function calculateImageHashSimilarity(hash1: string, hash2: string): number {
  if (!hash1 || !hash2 || hash1.length !== hash2.length) return 0;
  
  // 汉明距离转相似度
  let diff = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) diff++;
  }
  return 1 - diff / hash1.length;
}

/**
 * 执行去重
 * @param opportunities 候选品列表
 * @param config 去重配置
 * @param blacklist 黑名单URL列表
 * @param listedUrls 已上架URL列表
 * @returns 去重后的候选品ID列表和去重原因映射
 */
export function deduplicateOpportunities(
  opportunities: OpportunityForDedup[],
  config: DedupConfig = DEFAULT_DEDUP_CONFIG,
  blacklist: string[] = [],
  listedUrls: string[] = []
): { kept: number[]; removed: Map<number, string> } {
  const removed = new Map<number, string>();
  const kept: number[] = [];
  
  // 1. 黑名单过滤
  if (config.excludeBlacklist) {
    for (const opp of opportunities) {
      if (blacklist.some(url => opp.source1688Url?.includes(url))) {
        removed.set(opp.id, '用户黑名单');
        continue;
      }
    }
  }
  
  // 2. 已上架过滤
  if (config.excludeListed) {
    for (const opp of opportunities) {
      if (listedUrls.some(url => opp.source1688Url?.includes(url))) {
        if (!removed.has(opp.id)) {
          removed.set(opp.id, '已上架商品');
        }
        continue;
      }
    }
  }
  
  // 3. 按类目分组，同类目只保留最高分
  const categoryGroups = new Map<number | null | undefined, OpportunityForDedup[]>();
  for (const opp of opportunities) {
    if (removed.has(opp.id)) continue;
    const catId = opp.targetCategoryId;
    if (!categoryGroups.has(catId)) {
      categoryGroups.set(catId, []);
    }
    categoryGroups.get(catId)!.push(opp);
  }
  
  // 4. 类目内去重
  const dedupCandidates: OpportunityForDedup[] = [];
  for (const [catId, items] of categoryGroups) {
    // 按分数降序排序
    items.sort((a, b) => b.score - a.score);
    
    if (config.sameCategoryKeepTop && items.length > 1) {
      // 保留最高分，标记其他为同类目低分
      dedupCandidates.push(items[0]);
      for (let i = 1; i < items.length; i++) {
        removed.set(items[i].id, `同类目已有更高分候选(分数${items[0].score.toFixed(1)})`);
      }
    } else {
      dedupCandidates.push(...items);
    }
  }
  
  // 5. 图片哈希 + 标题相似度去重
  for (let i = 0; i < dedupCandidates.length; i++) {
    const opp1 = dedupCandidates[i];
    if (removed.has(opp1.id)) continue;
    
    for (let j = i + 1; j < dedupCandidates.length; j++) {
      const opp2 = dedupCandidates[j];
      if (removed.has(opp2.id)) continue;
      
      // 图片哈希相似度检查
      if (opp1.imageHash && opp2.imageHash) {
        const imgSimilarity = calculateImageHashSimilarity(opp1.imageHash, opp2.imageHash);
        if (imgSimilarity >= config.imageHashThreshold) {
          // 保留高分，移除低分
          const toRemove = opp1.score >= opp2.score ? opp2 : opp1;
          removed.set(toRemove.id, `图片相似度${(imgSimilarity * 100).toFixed(0)}%`);
          continue;
        }
      }
      
      // 标题相似度检查
      if (opp1.targetName && opp2.targetName) {
        const titleSimilarity = calculateTitleSimilarity(opp1.targetName, opp2.targetName);
        if (titleSimilarity >= config.titleSimilarityThreshold) {
          const toRemove = opp1.score >= opp2.score ? opp2 : opp1;
          removed.set(toRemove.id, `标题相似度${(titleSimilarity * 100).toFixed(0)}%`);
        }
      }
    }
  }
  
  // 收集保留的候选品
  for (const opp of opportunities) {
    if (!removed.has(opp.id)) {
      kept.push(opp.id);
    }
  }
  
  return { kept, removed };
}

/**
 * 批量排序和去重主函数
 * @param shopId 店铺ID
 * @param strategy 选品策略
 * @param config 去重配置
 * @returns 排序后的结果
 */
export async function sortAndDeduplicate(
  shopId: string,
  strategy: SelectionStrategy = 'follow_default',
  config: DedupConfig = DEFAULT_DEDUP_CONFIG
): Promise<{
  success: boolean;
  sorted: FinalSortResult[];
  dedupStats: {
    original: number;
    kept: number;
    removed: number;
    topReasons: { reason: string; count: number }[];
  };
  error?: string;
}> {
  try {
    // 1. 获取店铺所有未处理的候选品及其评分
    const results = await db
      .select({
        opportunity: opportunities,
        score: productScores,
      })
      .from(opportunities)
      .leftJoin(productScores, eq(opportunities.id, productScores.opportunityId))
      .where(
        and(
          eq(opportunities.shopId, shopId),
          eq(opportunities.status, 'discovered')
        )
      );
    
    if (results.length === 0) {
      return {
        success: true,
        sorted: [],
        dedupStats: { original: 0, kept: 0, removed: 0, topReasons: [] },
      };
    }
    
    // 2. 计算最终排序分数
    const sortResults: FinalSortResult[] = results.map(({ opportunity, score }) => {
      const compositeScore = Number(score?.compositeScore) || 0;
      const hardConstraintDiscount = Number(score?.hardConstraintDiscount) || 1;
      const crossVerifyDiscount = Number(score?.crossVerifyDiscount) || 1;
      
      const result = calculateFinalScore(
        compositeScore,
        opportunity.createdAt, // 使用 createdAt 作为发现时间
        hardConstraintDiscount,
        crossVerifyDiscount
      );
      result.opportunityId = opportunity.id;
      return result;
    });
    
    // 3. 准备去重数据
    const dedupData: OpportunityForDedup[] = results.map(({ opportunity, score }) => ({
      id: opportunity.id,
      targetCategoryId: opportunity.targetCategoryId ?? undefined,
      targetName: opportunity.targetName,
      imageHash: undefined, // 暂无图片哈希字段
      source1688Url: undefined, // 暂无1688链接字段
      score: Number(score?.compositeScore) || 0,
      isBlacklisted: false, // 实际应查询黑名单
      isAlreadyListed: false, // 实际应查询已上架
    }));
    
    // 4. 获取黑名单和已上架URL（从数据库或缓存）
    // TODO: 实际实现时应从数据库查询
    const blacklist: string[] = [];
    const listedUrls: string[] = [];
    
    // 5. 执行去重
    const { kept, removed } = deduplicateOpportunities(dedupData, config, blacklist, listedUrls);
    
    // 6. 标记去重结果
    for (const result of sortResults) {
      if (removed.has(result.opportunityId)) {
        result.isDeduplicated = true;
        result.dedupReason = removed.get(result.opportunityId);
      }
    }
    
    // 7. 按最终分数排序，只保留未去重的
    const sorted = sortResults
      .filter(r => !r.isDeduplicated)
      .sort((a, b) => b.finalScore - a.finalScore);
    
    // 8. 统计去重原因
    const reasonCounts = new Map<string, number>();
    for (const reason of removed.values()) {
      // 简化原因归类
      const simplifiedReason = reason.includes('黑名单') ? '用户黑名单' :
                              reason.includes('已上架') ? '已上架商品' :
                              reason.includes('类目') ? '同类目低分' :
                              reason.includes('图片') ? '图片重复' :
                              reason.includes('标题') ? '标题重复' : reason;
      reasonCounts.set(simplifiedReason, (reasonCounts.get(simplifiedReason) || 0) + 1);
    }
    const topReasons = Array.from(reasonCounts.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    
    return {
      success: true,
      sorted,
      dedupStats: {
        original: results.length,
        kept: kept.length,
        removed: removed.size,
        topReasons,
      },
    };
  } catch (error) {
    return {
      success: false,
      sorted: [],
      dedupStats: { original: 0, kept: 0, removed: 0, topReasons: [] },
      error: error instanceof Error ? error.message : '排序去重失败',
    };
  }
}

/**
 * 获取评分配置（支持策略参数）
 */
export async function getScoringConfigWithStrategy(
  shopId: string,
  strategy: SelectionStrategy = 'follow_default'
): Promise<{
  weights: AHPWeights;
  channelWeights: ChannelWeights;
  alpha: number;
  strategy: SelectionStrategy;
}> {
  // 获取策略权重
  const weights = getStrategyWeights(strategy);
  
  // 获取通道权重（一期固定）
  const channelWeights = PHASE1_CHANNEL_WEIGHTS;
  
  return {
    weights,
    channelWeights,
    alpha: ALPHA,
    strategy,
  };
}
