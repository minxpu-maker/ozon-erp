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
  const baseUrl = process.env.COZE_PROJECT_DOMAIN_DEFAULT || '';
  
  fetch(`${baseUrl}/api/translate`, {
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
 */
async function findLatestSignal(
  sourceType: string,
  productId: string
): Promise<typeof marketSignals.$inferSelect | null> {
  try {
    const records = await db
      .select()
      .from(marketSignals)
      .where(
        and(
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
 */
function isWithinMergeWindow(collectedAt: Date | string | null): boolean {
  if (!collectedAt) return false;
  
  const collected = new Date(collectedAt);
  const now = new Date();
  const hoursDiff = (now.getTime() - collected.getTime()) / (1000 * 60 * 60);
  
  return hoursDiff <= MERGE_WINDOW_HOURS;
}

/**
 * 处理单条信号 - 智能合并逻辑
 */
async function processSignal(
  shopId: string,
  signal: SignalInput
): Promise<ProcessResult> {
  const now = new Date();
  
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
  
  // 查找已有记录
  const existingRecord = await findLatestSignal(sourceType, signal.productId);
  
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
        productUrl: signal.productUrl,
        categoryPath: signal.categoryPath,
        price: signal.price ? String(signal.price) : null,
        originalPrice: signal.originalPrice ? String(signal.originalPrice) : null,
        salesVolume: signal.salesVolume ?? 0,
        rating: signal.rating ? String(signal.rating) : null,
        reviewsCount: signal.reviewsCount ?? 0,
        sellerCount: signal.sellerCount ?? 0,
        imageUrl: signal.imageUrl,
        images: signal.images,
        brandName: signal.brandName,
        productTitleZh: null,
        previousSignalId: null,
        rawData: signal.rawData || {},
        collectedAt: now,
        processedAt: null,
      })
      .returning({ id: marketSignals.id });
    
    signalId = newRecord.id;
    status = 'created';
    shouldTriggerTranslation = sourceType === 'ozon_market' && !!signal.productTitle;
    
  } else if (isWithinMergeWindow(existingRecord.collectedAt)) {
    // 情况B：24小时内，UPDATE 覆盖更新
    await db
      .update(marketSignals)
      .set({
        price: signal.price ? String(signal.price) : null,
        originalPrice: signal.originalPrice ? String(signal.originalPrice) : null,
        salesVolume: signal.salesVolume ?? 0,
        rating: signal.rating ? String(signal.rating) : null,
        reviewsCount: signal.reviewsCount ?? 0,
        sellerCount: signal.sellerCount ?? 0,
        imageUrl: signal.imageUrl,
        images: signal.images,
        brandName: signal.brandName,
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
        productUrl: signal.productUrl,
        categoryPath: signal.categoryPath,
        price: signal.price ? String(signal.price) : null,
        originalPrice: signal.originalPrice ? String(signal.originalPrice) : null,
        salesVolume: signal.salesVolume ?? 0,
        rating: signal.rating ? String(signal.rating) : null,
        reviewsCount: signal.reviewsCount ?? 0,
        sellerCount: signal.sellerCount ?? 0,
        imageUrl: signal.imageUrl,
        images: signal.images,
        brandName: signal.brandName,
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
  try {
    // 1. 鉴权验证
    const authResult = await authenticateExtension(request);
    
    if (!authResult.success) {
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
    
    // 5. 逐条处理信号
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
    
    // 6. 返回结果
    const successCount = results.filter(r => r.status !== 'skipped').length;
    const skipCount = results.filter(r => r.status === 'skipped').length;
    
    return NextResponse.json({
      ok: true,
      total: signals.length,
      success: successCount,
      skipped: skipCount,
      results,
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
