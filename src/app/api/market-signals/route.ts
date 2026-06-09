import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { marketSignals, shops } from '@/storage/database/shared/schema';
import { desc, eq, and, sql, inArray } from 'drizzle-orm';

/**
 * GET /api/market-signals
 * 查询市场信号列表（供前端展示）
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const sourceType = searchParams.get('sourceType');
    const productId = searchParams.get('productId');
    const shopId = searchParams.get('shopId');

    // 构建查询条件
    const conditions = [];
    if (sourceType && sourceType !== 'all') {
      conditions.push(eq(marketSignals.sourceType, sourceType));
    }
    if (productId) {
      conditions.push(eq(marketSignals.productId, productId));
    }
    if (shopId) {
      conditions.push(eq(marketSignals.shopId, shopId));
    }

    // 查询数据
    const signals = await db
      .select()
      .from(marketSignals)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(marketSignals.collectedAt))
      .limit(limit)
      .offset(offset);

    // 查询总数
    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(marketSignals)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const total = countResult[0]?.count || 0;

    // 获取涉及的店铺名称
    const shopIds = [...new Set(signals.map(s => s.shopId))];
    const shopMap = new Map<string, string>();
    if (shopIds.length > 0) {
      const shopList = await db
        .select({ id: shops.id, name: shops.name })
        .from(shops)
        .where(inArray(shops.id, shopIds));
      shopList.forEach(s => shopMap.set(s.id, s.name));
    }

    // 转换数据格式（处理 JSON 字段）
    const formattedSignals = signals.map(s => ({
      ...s,
      images: s.images || [],
      rawData: s.rawData || {},
      shopName: shopMap.get(s.shopId),
    }));

    return NextResponse.json({
      success: true,
      data: {
        signals: formattedSignals,
        total,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error('[MarketSignals] Query error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to query market signals' },
      { status: 500 }
    );
  }
}
