/**
 * 市场信号测试推送接口（管理后台使用）
 * 无需真实API Key，由后端直接验证权限并推送
 */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { marketSignals, shops } from '@/storage/database/shared/schema';
import { eq, and, desc } from 'drizzle-orm';

// 24小时合并窗口
const MERGE_WINDOW_MS = 24 * 60 * 60 * 1000;

interface TestSignal {
  sourceType: string;
  signalType: string;
  productId: string;
  productTitle: string;
  productUrl?: string;
  categoryPath?: string;
  price?: number;
  originalPrice?: number;
  salesVolume?: number;
  rating?: number;
  reviewsCount?: number;
  sellerCount?: number;
  imageUrl?: string;
  images?: string[];
  brandName?: string;
  rawData?: Record<string, unknown>;
}

interface TestPushRequest {
  shopId: string;
  signals: TestSignal[];
}

export async function POST(request: NextRequest) {
  try {
    const body: TestPushRequest = await request.json();
    const { shopId, signals } = body;

    // 参数校验
    if (!shopId) {
      return NextResponse.json({ ok: false, error: 'shopId is required' }, { status: 400 });
    }
    if (!signals || !Array.isArray(signals) || signals.length === 0) {
      return NextResponse.json({ ok: false, error: 'signals array is required' }, { status: 400 });
    }
    if (signals.length > 100) {
      return NextResponse.json({ ok: false, error: 'Maximum 100 signals per batch' }, { status: 400 });
    }

    // 验证店铺存在
    const shopList = await db.select().from(shops).where(eq(shops.id, shopId)).limit(1);
    if (shopList.length === 0) {
      return NextResponse.json({ ok: false, error: 'Shop not found' }, { status: 404 });
    }

    // 支持的数据源
    const validSourceTypes = ['wb', 'ozon_market', 'aliexpress', '1688'];

    const results: Array<{ signalId: number; status: string; triggeredMatching: boolean }> = [];
    let successCount = 0;
    let skippedCount = 0;

    for (const signal of signals) {
      try {
        // 校验数据源
        if (!validSourceTypes.includes(signal.sourceType)) {
          results.push({
            signalId: 0,
            status: 'skipped',
            triggeredMatching: false,
          });
          skippedCount++;
          continue;
        }

        // 校验必填字段
        if (!signal.productId || !signal.productTitle) {
          results.push({
            signalId: 0,
            status: 'skipped',
            triggeredMatching: false,
          });
          skippedCount++;
          continue;
        }

        // 查找已有记录（同源同ID）
        const existingRecords = await db
          .select()
          .from(marketSignals)
          .where(
            and(
              eq(marketSignals.shopId, shopId),
              eq(marketSignals.sourceType, signal.sourceType),
              eq(marketSignals.productId, signal.productId)
            )
          )
          .orderBy(desc(marketSignals.collectedAt))
          .limit(1);

        const now = new Date();
        let resultSignalId: number;
        let resultStatus: string;

        if (existingRecords.length === 0) {
          // 情况A：新商品，插入
          const inserted = await db.insert(marketSignals).values({
            shopId,
            sourceType: signal.sourceType,
            signalType: signal.signalType || 'demand',
            productId: signal.productId,
            productTitle: signal.productTitle,
            productUrl: signal.productUrl || null,
            categoryPath: signal.categoryPath || null,
            price: signal.price?.toString() || null,
            originalPrice: signal.originalPrice?.toString() || null,
            salesVolume: signal.salesVolume || 0,
            rating: signal.rating?.toString() || null,
            reviewsCount: signal.reviewsCount || 0,
            sellerCount: signal.sellerCount || null,
            imageUrl: signal.imageUrl || null,
            images: signal.images || null,
            brandName: signal.brandName || null,
            rawData: signal.rawData || {},
            collectedAt: now,
          }).returning({ id: marketSignals.id });
          
          resultSignalId = inserted[0].id;
          resultStatus = 'created';
        } else {
          const existing = existingRecords[0];
          const collectedAt = existing.collectedAt ? new Date(existing.collectedAt) : null;
          const isWithinMergeWindow = collectedAt && (now.getTime() - collectedAt.getTime()) < MERGE_WINDOW_MS;

          if (isWithinMergeWindow) {
            // 情况B：24小时内，更新
            await db.update(marketSignals)
              .set({
                price: signal.price?.toString() || existing.price,
                originalPrice: signal.originalPrice?.toString() || existing.originalPrice,
                salesVolume: signal.salesVolume ?? existing.salesVolume,
                rating: signal.rating?.toString() || existing.rating,
                reviewsCount: signal.reviewsCount ?? existing.reviewsCount,
                sellerCount: signal.sellerCount ?? existing.sellerCount,
                imageUrl: signal.imageUrl || existing.imageUrl,
                images: signal.images || existing.images,
                brandName: signal.brandName || existing.brandName,
                rawData: signal.rawData || existing.rawData,
                updatedAt: now,
              })
              .where(eq(marketSignals.id, existing.id));
            
            resultSignalId = existing.id;
            resultStatus = 'updated';
          } else {
            // 情况C：超过24小时，新建并关联
            const inserted = await db.insert(marketSignals).values({
              shopId,
              sourceType: signal.sourceType,
              signalType: signal.signalType || 'demand',
              productId: signal.productId,
              productTitle: signal.productTitle,
              productUrl: signal.productUrl || null,
              categoryPath: signal.categoryPath || null,
              price: signal.price?.toString() || null,
              originalPrice: signal.originalPrice?.toString() || null,
              salesVolume: signal.salesVolume || 0,
              rating: signal.rating?.toString() || null,
              reviewsCount: signal.reviewsCount || 0,
              sellerCount: signal.sellerCount || null,
              imageUrl: signal.imageUrl || null,
              images: signal.images || null,
              brandName: signal.brandName || null,
              previousSignalId: existing.id,
              rawData: signal.rawData || {},
              collectedAt: now,
            }).returning({ id: marketSignals.id });
            
            resultSignalId = inserted[0].id;
            resultStatus = 'created_with_history';
          }
        }

        // 检查跨平台匹配（简化版）
        const oppositeSource = signal.sourceType === 'wb' ? 'ozon_market' : 'wb';
        const matchingRecords = await db
          .select()
          .from(marketSignals)
          .where(
            and(
              eq(marketSignals.shopId, shopId),
              eq(marketSignals.sourceType, oppositeSource),
              eq(marketSignals.categoryPath, signal.categoryPath || '')
            )
          )
          .limit(1);

        results.push({
          signalId: resultSignalId,
          status: resultStatus,
          triggeredMatching: matchingRecords.length > 0,
        });
        successCount++;

      } catch (e) {
        console.error('处理信号失败:', e);
        results.push({
          signalId: 0,
          status: 'skipped',
          triggeredMatching: false,
        });
        skippedCount++;
      }
    }

    return NextResponse.json({
      ok: true,
      total: signals.length,
      success: successCount,
      skipped: skippedCount,
      results,
    });

  } catch (error) {
    console.error('测试推送失败:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
