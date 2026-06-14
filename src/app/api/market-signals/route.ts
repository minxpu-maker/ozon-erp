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
// 有效的参数值白名单
const VALID_SOURCE_TYPES = ['wb', 'ozon_market', 'aliexpress', '1688'];
const VALID_SIGNAL_TYPES = ['demand', 'competition'];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // 安全解析数字参数，防止 NaN
    const limitParam = parseInt(searchParams.get('limit') || '20', 10);
    const offsetParam = parseInt(searchParams.get('offset') || '0', 10);
    const limit = Math.min(Math.max(isNaN(limitParam) ? 20 : limitParam, 1), 100);
    const offset = Math.max(isNaN(offsetParam) ? 0 : offsetParam, 0);
    
    // 参数值白名单验证
    const sourceTypeParam = searchParams.get('sourceType');
    const signalTypeParam = searchParams.get('signalType');
    const sourceType = sourceTypeParam && VALID_SOURCE_TYPES.includes(sourceTypeParam) 
      ? sourceTypeParam : null;
    const signalType = signalTypeParam && VALID_SIGNAL_TYPES.includes(signalTypeParam) 
      ? signalTypeParam : null;
    
    const productId = searchParams.get('productId');
    const shopId = searchParams.get('shopId');

    // 构建查询条件
    const conditions = [];
    if (sourceType) {
      conditions.push(eq(marketSignals.sourceType, sourceType));
    }
    if (signalType) {
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

    // 获取涉及的店铺名称（安全处理空数组）
    const shopIds = [...new Set(signals.map(s => s.shopId).filter(Boolean))];
    const shopMap = new Map<string, string>();
    if (shopIds.length > 0) {
      try {
        const shopList = await db
          .select({ id: shops.id, name: shops.name })
          .from(shops)
          .where(inArray(shops.id, shopIds));
        shopList.forEach(s => shopMap.set(s.id, s.name));
      } catch (shopError) {
        console.warn('[MarketSignals] Failed to fetch shop names:', shopError);
        // 继续执行，店铺名称非必须
      }
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
      images: toProxyUrls(Array.isArray(s.images) ? s.images.filter((img): img is string => typeof img === 'string') : null),
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
      // V4新增字段
      sellerName: s.sellerName,
      sellerType: s.sellerType,
      followerCount: s.followerCount,
      variantCount: s.variantCount,
      deliveryType: s.deliveryType,
      weight: s.weight,
      dimensionLength: s.dimensionLength,
      dimensionWidth: s.dimensionWidth,
      dimensionHeight: s.dimensionHeight,
      volume: s.volume,
      listedDate: s.listedDate,
      stock: s.stock,
      revenue: s.revenue,
      profitRate: s.profitRate,
      purchaseCost: s.purchaseCost,
      // API占位字段
      returnRate: s.returnRate,
      impressions: s.impressions,
      cardViews: s.cardViews,
      cartRate: s.cartRate,
      adShare: s.adShare,
      // 历史趋势链
      previousSignalId: s.previousSignalId,
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
