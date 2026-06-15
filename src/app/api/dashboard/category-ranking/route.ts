import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { marketSignals } from '@/storage/database/shared/schema';
import { eq, and, sql, desc, gte } from 'drizzle-orm';
import { cache } from '@/lib/cache/memory-cache';

// 缓存时间：10分钟
const CACHE_TTL = 600;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const platform = searchParams.get('platform') || 'ozon';
    const limit = parseInt(searchParams.get('limit') || '20');

    // 构建缓存key
    const cacheKey = `category-ranking:${platform}:${limit}`;

    // 尝试从缓存获取
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return NextResponse.json({ success: true, data: cachedData, cached: true });
    }

    // 转换平台参数
    const sourceType = platform === 'wb' ? 'wb' : 'ozon_market';

    // 按类目聚合，查询各项指标
    const categoryRanking = await db
      .select({
        category: marketSignals.categoryPath,
        productCount: sql<number>`COUNT(DISTINCT ${marketSignals.productId})`,
        avgPrice: sql<string>`AVG(CAST(${marketSignals.price} AS DECIMAL))`,
        totalSales: sql<string>`SUM(${marketSignals.salesVolume})`,
        avgSales: sql<string>`AVG(${marketSignals.salesVolume})`,
        totalRevenue: sql<string>`SUM(CAST(${marketSignals.revenue} AS DECIMAL))`,
        avgRating: sql<string>`AVG(CAST(${marketSignals.rating} AS DECIMAL))`,
        sellerCount: sql<number>`COUNT(DISTINCT ${marketSignals.sellerName})`,
      })
      .from(marketSignals)
      .where(and(
        eq(marketSignals.sourceType, sourceType),
        sql`${marketSignals.categoryPath} IS NOT NULL`
      ))
      .groupBy(marketSignals.categoryPath)
      .orderBy(desc(sql`SUM(CAST(${marketSignals.revenue} AS DECIMAL))`))
      .limit(limit);

    // 计算增长率（简化版：基于采集时间分布估算）
    // 实际场景中应该基于历史数据对比
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);

    const recentData = await db
      .select({
        category: marketSignals.categoryPath,
        recentCount: sql<number>`COUNT(*)`,
      })
      .from(marketSignals)
      .where(and(
        eq(marketSignals.sourceType, sourceType),
        gte(marketSignals.collectedAt, sevenDaysAgo),
        sql`${marketSignals.categoryPath} IS NOT NULL`
      ))
      .groupBy(marketSignals.categoryPath);

    const olderData = await db
      .select({
        category: marketSignals.categoryPath,
        olderCount: sql<number>`COUNT(*)`,
      })
      .from(marketSignals)
      .where(and(
        eq(marketSignals.sourceType, sourceType),
        gte(marketSignals.collectedAt, thirtyDaysAgo),
        gte(marketSignals.collectedAt, sevenDaysAgo),
        sql`${marketSignals.categoryPath} IS NOT NULL`
      ))
      .groupBy(marketSignals.categoryPath);

    // 构建增长率map
    const recentMap = new Map(recentData.map(d => [d.category, d.recentCount]));
    const olderMap = new Map(olderData.map(d => [d.category, d.olderCount]));

    // 组装结果
    const data = categoryRanking.map((row) => {
      const recentCount = recentMap.get(row.category) || 0;
      const olderCount = olderMap.get(row.category) || 0;
      // 增长率计算：(本周数量 / 上周数量 - 1) * 100
      const growth = olderCount > 0
        ? (((recentCount / olderCount) - 1) * 100).toFixed(2)
        : recentCount > 0 ? '100.00' : '0.00';

      return {
        category: row.category,
        productCount: Number(row.productCount),
        avgPrice: parseFloat(row.avgPrice || '0'),
        avgSales: parseFloat(row.avgSales || '0'),
        totalSales: Number(row.totalSales || 0),
        revenue: parseFloat(row.totalRevenue || '0'),
        growth: parseFloat(growth),
        sellerCount: Number(row.sellerCount),
        avgRating: parseFloat(row.avgRating || '0'),
      };
    });

    // 按revenue降序（已在SQL中排序）
    data.sort((a, b) => b.revenue - a.revenue);

    // 存入缓存
    cache.set(cacheKey, data, CACHE_TTL);

    return NextResponse.json({ success: true, data, cached: false });
  } catch (error) {
    console.error('[CategoryRanking] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch category ranking' },
      { status: 500 }
    );
  }
}
