import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { marketSignals } from '@/storage/database/shared/schema';
import { eq, and, desc, gte, isNotNull, sql } from 'drizzle-orm';
import { cache } from '@/lib/cache/memory-cache';

// 缓存时间：10分钟
const CACHE_TTL = 600;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const platform = searchParams.get('platform') || 'ozon';
    const days = parseInt(searchParams.get('days') || '7');
    const limit = parseInt(searchParams.get('limit') || '20');

    // 构建缓存key
    const cacheKey = `new-arrivals:${platform}:${days}:${limit}`;

    // 尝试从缓存获取
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return NextResponse.json({ success: true, data: cachedData, cached: true });
    }

    // 转换平台参数
    const sourceType = platform === 'wb' ? 'wb' : 'ozon_market';

    // 计算日期范围
    const daysAgo = new Date(Date.now() - days * 86400000);

    // 按上架日期筛选近N天新品，按销量降序
    const newArrivals = await db
      .select({
        productId: marketSignals.productId,
        productTitle: marketSignals.productTitle,
        imageUrl: marketSignals.imageUrl,
        price: marketSignals.price,
        originalPrice: marketSignals.originalPrice,
        salesVolume: marketSignals.salesVolume,
        rating: marketSignals.rating,
        reviewsCount: marketSignals.reviewsCount,
        categoryPath: marketSignals.categoryPath,
        listedDate: marketSignals.listedDate,
        sourceType: marketSignals.sourceType,
      })
      .from(marketSignals)
      .where(and(
        eq(marketSignals.sourceType, sourceType),
        sql`${marketSignals.listedDate} >= ${daysAgo.toISOString().split('T')[0]}`,
        sql`${marketSignals.listedDate} IS NOT NULL`,
        sql`${marketSignals.productTitle} IS NOT NULL`
      ))
      .orderBy(desc(marketSignals.salesVolume))
      .limit(limit);

    // 组装结果
    const data = newArrivals.map((product) => ({
      productId: product.productId,
      productTitle: product.productTitle,
      imageUrl: product.imageUrl,
      price: parseFloat(product.price || '0'),
      originalPrice: parseFloat(product.originalPrice || '0'),
      sales: Number(product.salesVolume || 0),
      rating: parseFloat(product.rating || '0'),
      reviewCount: Number(product.reviewsCount || 0),
      category: product.categoryPath,
      listedDate: product.listedDate,
      platform: product.sourceType === 'wb' ? 'wb' : 'ozon',
    }));

    // 存入缓存
    cache.set(cacheKey, data, CACHE_TTL);

    return NextResponse.json({ success: true, data, cached: false });
  } catch (error) {
    console.error('[NewArrivals] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch new arrivals' },
      { status: 500 }
    );
  }
}
