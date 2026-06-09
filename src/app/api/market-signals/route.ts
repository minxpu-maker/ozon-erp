import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { marketSignals, shops } from '@/storage/database/shared/schema';
import { desc, eq, and, sql, inArray } from 'drizzle-orm';

/**
 * 将图片URL转换为代理格式
 * @param url 原始图片URL
 * @returns 代理URL或null
 */
function toProxyUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null;
  // 跳过已经是代理URL的
  if (url.startsWith('/api/image-proxy')) return url;
  return `/api/image-proxy?url=${encodeURIComponent(url)}`;
}

/**
 * 将图片URL数组转换为代理格式
 * @param urls 原始图片URL数组
 * @returns 代理URL数组
 */
function toProxyUrls(urls: string[] | null | undefined): string[] {
  if (!urls || !Array.isArray(urls)) return [];
  return urls.map(url => toProxyUrl(url)).filter((url): url is string => url !== null);
}

/**
 * GET /api/market-signals
 * 查询市场信号列表（供前端展示）
 * 
 * 查询参数：
 * - sourceType: 数据来源筛选 (wb, ozon_market, aliexpress, 1688)
 * - signalType: 信号类型筛选 (demand, competition)
 * - limit: 每页条数，默认20，最大100
 * - offset: 分页偏移，默认0
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const sourceType = searchParams.get('sourceType');
    const signalType = searchParams.get('signalType');
    const productId = searchParams.get('productId');
    const shopId = searchParams.get('shopId');

    // 构建查询条件
    const conditions = [];
    if (sourceType && sourceType !== 'all') {
      conditions.push(eq(marketSignals.sourceType, sourceType));
    }
    if (signalType && signalType !== 'all') {
      conditions.push(eq(marketSignals.signalType, signalType));
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

    // 转换数据格式
    // 关键：图片URL必须转为代理格式，前端拿到就能直接用
    const formattedSignals = signals.map(s => ({
      id: s.id,
      shopId: s.shopId,
      shopName: shopMap.get(s.shopId),
      sourceType: s.sourceType,
      signalType: s.signalType,
      productId: s.productId,
      productTitle: s.productTitle,
      productTitleZh: s.productTitleZh, // 中文翻译，有值前端显示中文，无值显示俄语原文
      productUrl: s.productUrl,
      // 关键转换：图片URL改为代理格式
      imageUrl: toProxyUrl(s.imageUrl),
      images: toProxyUrls(Array.isArray(s.images) ? s.images as string[] : null),
      brandName: s.brandName,
      categoryPath: s.categoryPath,
      categoryId: s.categoryId,
      categoryName: s.categoryName,
      price: s.price,
      originalPrice: s.originalPrice,
      salesVolume: s.salesVolume,
      rating: s.rating,
      reviewsCount: s.reviewsCount,
      sellerCount: s.sellerCount,
      previousSignalId: s.previousSignalId, // 历史趋势链
      collectedAt: s.collectedAt,
      processedAt: s.processedAt,
      rawData: s.rawData || {},
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
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
