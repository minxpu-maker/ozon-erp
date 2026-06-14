/**
 * 市场信号批量推送接口
 * 
 * POST /api/market-signals/batch
 * Chrome插件采集数据后调用此接口批量推送
 * 
 * 核心功能：
 * - 智能合并：24小时内更新，超过24小时新建并关联历史
 * - 跨平台匹配检查
 * - 异步触发翻译
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { marketSignals } from '@/storage/database/shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { 
  authenticateExtension, 
  hasPermission, 
  createAuthErrorResponse 
} from '@/lib/auth/extension-auth';

// 合法的 sourceType
const VALID_SOURCE_TYPES = ['wb', 'ozon_market'] as const;
type SourceType = typeof VALID_SOURCE_TYPES[number];

// 智能合并时间窗口（24小时）
const MERGE_WINDOW_HOURS = 24;

// ============================================================================
// 类型定义
// ============================================================================

interface SignalInput {
  sourceType: string;
  signalType: string;
  productId: string;
  productTitle: string;
  productUrl: string;
  categoryPath: string;
  price: number | null;
  originalPrice: number | null;
  salesVolume: number | null;
  rating: number | null;
  reviewsCount: number | null;
  sellerCount: number | null;
  imageUrl: string | null;
  images: string[] | null;
  brandName: string | null;
  rawData: Record<string, unknown> | null;
  // V4新增字段
  sellerName?: string | null;
  sellerType?: string | null;
  followerCount?: number | null;
  variantCount?: number | null;
  deliveryType?: string | null;
  weight?: number | null;
  dimensions?: { length?: number | null; width?: number | null; height?: number | null } | null;
  volume?: number | null;
  listedDate?: string | null;
  stock?: number | null;
  revenue?: number | null;
  profitRate?: number | null;
  purchaseCost?: number | null;
  returnRate?: number | null;
  impressions?: number | null;
  cardViews?: number | null;
  cartRate?: number | null;
  adShare?: number | null;
}

interface BatchRequest {
  shopId: string;
  signals: SignalInput[];
}

interface ProcessResult {
  signalId: number;
  status: 'created' | 'updated' | 'created_with_history' | 'skipped';
  triggeredMatching: boolean;
  error?: string;
}

// ============================================================================
// 调试日志（生产环境应移除）
// ============================================================================
function debugLog(...args: unknown[]) {
  const timestamp = new Date().toISOString();
  console.log(`[BATCH DEBUG ${timestamp}]`, ...args);
}

// ============================================================================
// 核心函数
// ============================================================================

/**
 * 检查跨平台匹配
 * 
 * 如果 wb 平台有数据，检查 ozon_market 是否有相同品类
 * 如果 ozon_market 平台有数据，检查 wb 是否有相同品类
 */
async function checkCrossPlatformMatch(
  sourceType: SourceType,
  categoryPath: string
): Promise<boolean> {
  try {
    if (!categoryPath) return false;
    
    const targetSourceType = sourceType === 'wb' ? 'ozon_market' : 'wb';
    
    const records = await db
      .select({ id: marketSignals.id })
      .from(marketSignals)
      .where(
        and(
          eq(marketSignals.sourceType, targetSourceType),
          eq(marketSignals.categoryPath, categoryPath)
        )
      )
      .limit(1);
    
    return records.length > 0;
  } catch (error) {
    console.error('[CrossPlatformMatch] Check error:', error);
    return false;
  }
}

/**
 * 触发异步翻译
 * 
 * 仅对 ozon_market 来源的新记录触发翻译（俄语 → 中文）
 */
function triggerTranslation(signalId: number, text: string): void {
  // 获取基础URL，优先使用环境变量，否则使用本地地址
  const baseUrl = process.env.COZE_PROJECT_DOMAIN_DEFAULT || 'http://localhost:5000';
  
  // 避免URL拼接问题
  const translateUrl = baseUrl.endsWith('/') 
    ? `${baseUrl}api/translate` 
    : `${baseUrl}/api/translate`;
  
  fetch(translateUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      signalId, 
      text, 
      from: 'ru', 
      to: 'zh' 
    }),
  }).catch(err => {
    console.error('[Translation] Failed to trigger translation:', err);
  });
}

/**
 * 查找同一商品的最新记录
 * 
 * 注意：必须同时匹配 shopId、sourceType、productId，防止跨店铺数据混淆
 */
async function findLatestSignal(
  shopId: string,
  sourceType: string,
  productId: string
): Promise<typeof marketSignals.$inferSelect | null> {
  try {
    const records = await db
      .select()
      .from(marketSignals)
      .where(
        and(
          eq(marketSignals.shopId, shopId),
          eq(marketSignals.sourceType, sourceType),
          eq(marketSignals.productId, productId)
        )
      )
      .orderBy(desc(marketSignals.collectedAt))
      .limit(1);
    
    return records.length > 0 ? records[0] : null;
  } catch (error) {
    console.error('[FindLatestSignal] Query error:', error);
    return null;
  }
}

/**
 * 判断是否在合并窗口内（24小时）
 * 
 * 安全处理无效日期：如果日期无效，返回 false（视为超过窗口）
 */
function isWithinMergeWindow(collectedAt: Date | string | null): boolean {
  if (!collectedAt) return false;
  
  const collected = new Date(collectedAt);
  const now = new Date();
  
  // 检查日期是否有效
  if (isNaN(collected.getTime()) || isNaN(now.getTime())) {
    return false;
  }
  
  const hoursDiff = (now.getTime() - collected.getTime()) / (1000 * 60 * 60);
  
  // 确保计算结果有效
  if (isNaN(hoursDiff)) return false;
  
  return hoursDiff <= MERGE_WINDOW_HOURS;
}

/**
 * 验证信号数据完整性
 */
function validateSignal(signal: SignalInput): { valid: boolean; error?: string } {
  // 检查 productId
  if (!signal.productId || signal.productId.trim() === '') {
    return { valid: false, error: 'productId is required and cannot be empty' };
  }
  
  // 检查 productTitle
  if (!signal.productTitle || signal.productTitle.trim() === '') {
    return { valid: false, error: 'productTitle is required and cannot be empty' };
  }
  
  // 检查 sourceType
  if (!signal.sourceType) {
    return { valid: false, error: 'sourceType is required' };
  }
  
  return { valid: true };
}

/**
 * 处理单条信号 - 智能合并逻辑
 */
async function processSignal(
  shopId: string,
  signal: SignalInput
): Promise<ProcessResult> {
  const now = new Date();
  
  // 验证数据完整性
  const validation = validateSignal(signal);
  if (!validation.valid) {
    return {
      signalId: 0,
      status: 'skipped',
      triggeredMatching: false,
      error: validation.error,
    };
  }
  
  // 验证 sourceType
  if (!VALID_SOURCE_TYPES.includes(signal.sourceType as SourceType)) {
    return {
      signalId: 0,
      status: 'skipped',
      triggeredMatching: false,
      error: `Invalid sourceType: ${signal.sourceType}. Must be one of: ${VALID_SOURCE_TYPES.join(', ')}`,
    };
  }
  
  const sourceType = signal.sourceType as SourceType;
  
  // 查找已有记录（包含 shopId 过滤）
  const existingRecord = await findLatestSignal(shopId, sourceType, signal.productId);
  
  let signalId: number;
  let status: 'created' | 'updated' | 'created_with_history';
  let shouldTriggerTranslation = false;
  
  if (!existingRecord) {
    // 情况A：全新商品，INSERT 新记录
    const [newRecord] = await db
      .insert(marketSignals)
      .values({
        shopId,
        sourceType,
        signalType: signal.signalType || 'demand',
        productId: signal.productId,
        productTitle: signal.productTitle,
        productUrl: signal.productUrl || null,
        categoryPath: signal.categoryPath || null,
        price: signal.price != null ? String(signal.price) : null,
        originalPrice: signal.originalPrice != null ? String(signal.originalPrice) : null,
        salesVolume: Math.floor(Number(signal.salesVolume)) || 0,
        rating: signal.rating != null ? String(signal.rating) : null,
        reviewsCount: Math.floor(Number(signal.reviewsCount)) || 0,
        sellerCount: Math.floor(Number(signal.sellerCount)) || 0,
        imageUrl: signal.imageUrl || null,
        images: signal.images || null,
        brandName: signal.brandName || null,
        // ========== V4 新增字段 ==========
        sellerName: signal.sellerName || null,
        sellerType: signal.sellerType || null,
        followerCount: Math.floor(Number(signal.followerCount)) || null,
        variantCount: Math.floor(Number(signal.variantCount)) || null,
        deliveryType: signal.deliveryType || null,
        weight: signal.weight != null ? String(signal.weight) : null,
        dimensionLength: signal.dimensions?.length != null ? String(signal.dimensions.length) : null,
        dimensionWidth: signal.dimensions?.width != null ? String(signal.dimensions.width) : null,
        dimensionHeight: signal.dimensions?.height != null ? String(signal.dimensions.height) : null,
        volume: signal.volume != null ? String(signal.volume) : null,
        listedDate: signal.listedDate || null,
        stock: Math.floor(Number(signal.stock)) || null,
        revenue: signal.revenue != null ? String(signal.revenue) : null,
        profitRate: signal.profitRate != null ? String(signal.profitRate) : null,
        purchaseCost: signal.purchaseCost != null ? String(signal.purchaseCost) : null,
        returnRate: signal.returnRate != null ? String(signal.returnRate) : null,
        impressions: Math.floor(Number(signal.impressions)) || null,
        cardViews: Math.floor(Number(signal.cardViews)) || null,
        cartRate: signal.cartRate != null ? String(signal.cartRate) : null,
        adShare: signal.adShare != null ? String(signal.adShare) : null,
        // ========== V4 字段结束 ==========
        productTitleZh: null,
        previousSignalId: null,
        rawData: signal.rawData || {},
        collectedAt: now,
        processedAt: null,
      })
      .returning({ id: marketSignals.id });
    
    // Debug: check inserted values
    const inserted = await db.query.marketSignals.findFirst({
      where: eq(marketSignals.id, newRecord.id),
    });
    console.log('[V4 DEBUG] Inserted sellerName:', inserted?.sellerName, 'weight:', inserted?.weight);
    
    signalId = newRecord.id;
    status = 'created';
    shouldTriggerTranslation = sourceType === 'ozon_market' && !!signal.productTitle;
    
  } else if (isWithinMergeWindow(existingRecord.collectedAt)) {
    // 情况B：24小时内，UPDATE 覆盖更新
    await db
      .update(marketSignals)
      .set({
        price: signal.price != null ? String(signal.price) : null,
        originalPrice: signal.originalPrice != null ? String(signal.originalPrice) : null,
        salesVolume: Math.floor(Number(signal.salesVolume)) || 0,
        rating: signal.rating != null ? String(signal.rating) : null,
        reviewsCount: Math.floor(Number(signal.reviewsCount)) || 0,
        sellerCount: Math.floor(Number(signal.sellerCount)) || 0,
        imageUrl: signal.imageUrl || null,
        images: signal.images || null,
        brandName: signal.brandName || null,
        // ========== V4 新增字段 ==========
        sellerName: signal.sellerName || null,
        sellerType: signal.sellerType || null,
        followerCount: Math.floor(Number(signal.followerCount)) || null,
        variantCount: Math.floor(Number(signal.variantCount)) || null,
        deliveryType: signal.deliveryType || null,
        weight: signal.weight != null ? String(signal.weight) : null,
        dimensionLength: signal.dimensions?.length != null ? String(signal.dimensions.length) : null,
        dimensionWidth: signal.dimensions?.width != null ? String(signal.dimensions.width) : null,
        dimensionHeight: signal.dimensions?.height != null ? String(signal.dimensions.height) : null,
        volume: signal.volume != null ? String(signal.volume) : null,
        listedDate: signal.listedDate || null,
        stock: Math.floor(Number(signal.stock)) || null,
        revenue: signal.revenue != null ? String(signal.revenue) : null,
        profitRate: signal.profitRate != null ? String(signal.profitRate) : null,
        purchaseCost: signal.purchaseCost != null ? String(signal.purchaseCost) : null,
        returnRate: signal.returnRate != null ? String(signal.returnRate) : null,
        impressions: Math.floor(Number(signal.impressions)) || null,
        cardViews: Math.floor(Number(signal.cardViews)) || null,
        cartRate: signal.cartRate != null ? String(signal.cartRate) : null,
        adShare: signal.adShare != null ? String(signal.adShare) : null,
        // ========== V4 字段结束 ==========
        rawData: signal.rawData || {},
        processedAt: null, // 标记为未处理，让引擎重新分析
        updatedAt: now,
      })
      .where(eq(marketSignals.id, existingRecord.id));
    
    signalId = existingRecord.id;
    status = 'updated';
    // UPDATE 不触发翻译
    
  } else {
    // 情况C：超过24小时，INSERT 新记录并关联历史
    const [newRecord] = await db
      .insert(marketSignals)
      .values({
        shopId,
        sourceType,
        signalType: signal.signalType || 'demand',
        productId: signal.productId,
        productTitle: signal.productTitle,
        productUrl: signal.productUrl || null,
        categoryPath: signal.categoryPath || null,
        price: signal.price != null ? String(signal.price) : null,
        originalPrice: signal.originalPrice != null ? String(signal.originalPrice) : null,
        salesVolume: Math.floor(Number(signal.salesVolume)) || 0,
        rating: signal.rating != null ? String(signal.rating) : null,
        reviewsCount: Math.floor(Number(signal.reviewsCount)) || 0,
        sellerCount: Math.floor(Number(signal.sellerCount)) || 0,
        imageUrl: signal.imageUrl || null,
        images: signal.images || null,
        brandName: signal.brandName || null,
        productTitleZh: null,
        previousSignalId: existingRecord.id, // 关联上一次记录
        rawData: signal.rawData || {},
        collectedAt: now,
        processedAt: null,
      })
      .returning({ id: marketSignals.id });
    
    signalId = newRecord.id;
    status = 'created_with_history';
    shouldTriggerTranslation = sourceType === 'ozon_market' && !!signal.productTitle;
  }
  
  // 触发异步翻译（仅新记录）
  if (shouldTriggerTranslation && signal.productTitle) {
    triggerTranslation(signalId, signal.productTitle);
  }
  
  // 检查跨平台匹配
  const triggeredMatching = await checkCrossPlatformMatch(sourceType, signal.categoryPath);
  
  return {
    signalId,
    status,
    triggeredMatching,
  };
}

// ============================================================================
// API Handler
// ============================================================================

/**
 * POST /api/market-signals/batch
 * 批量推送市场信号
 */
export async function POST(request: NextRequest) {
  // 记录原始请求信息用于调试
  const authHeader = request.headers.get('Authorization');
  debugLog('Request received');
  debugLog('Auth header:', authHeader ? `Bearer ${authHeader.substring(0, 20)}...` : 'MISSING');
  
  try {
    // 1. 鉴权验证
    const authResult = await authenticateExtension(request);
    debugLog('Auth result:', authResult);
    
    if (!authResult.success) {
      debugLog('Auth failed:', authResult.error);
      return createAuthErrorResponse(authResult);
    }
    
    // 2. 权限检查
    if (!hasPermission(authResult.permissions, 'write:signals')) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Forbidden: Missing required permission: write:signals',
        },
        { status: 403 }
      );
    }
    
    // 3. 解析请求体
    const body: BatchRequest = await request.json();
    const { shopId, signals } = body;
    
    // 4. 安全校验
    if (!shopId) {
      return NextResponse.json(
        { ok: false, error: 'Missing required field: shopId' },
        { status: 400 }
      );
    }
    
    // shopId 和鉴权结果的 shopId 必须一致
    if (shopId !== authResult.shopId) {
      return NextResponse.json(
        { ok: false, error: 'Shop ID mismatch' },
        { status: 403 }
      );
    }
    
    if (!signals || !Array.isArray(signals) || signals.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'signals must be a non-empty array' },
        { status: 400 }
      );
    }
    
    // 限制批量大小（防止滥用）
    if (signals.length > 100) {
      return NextResponse.json(
        { ok: false, error: 'Maximum 100 signals per batch' },
        { status: 400 }
      );
    }
    
    // 5. 检查批量中重复的 productId（去重提示）
    const productIdSet = new Set<string>();
    const duplicates: string[] = [];
    
    for (const signal of signals) {
      if (signal.productId) {
        if (productIdSet.has(signal.productId)) {
          duplicates.push(signal.productId);
        } else {
          productIdSet.add(signal.productId);
        }
      }
    }
    
    // 6. 逐条处理信号
    const results: ProcessResult[] = [];
    
    for (const signal of signals) {
      try {
        const result = await processSignal(shopId, signal);
        results.push(result);
      } catch (error) {
        console.error('[BatchPush] Process signal error:', error);
        results.push({
          signalId: 0,
          status: 'skipped',
          triggeredMatching: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
    
    // 7. 返回结果
    const successCount = results.filter(r => r.status !== 'skipped').length;
    const skipCount = results.filter(r => r.status === 'skipped').length;
    
    return NextResponse.json({
      ok: true,
      total: signals.length,
      success: successCount,
      skipped: skipCount,
      results,
      ...(duplicates.length > 0 && { 
        warning: `Duplicate productId detected in batch: ${duplicates.join(', ')}. Each processed separately.` 
      }),
    });
    
  } catch (error) {
    console.error('[MarketSignals Batch] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
