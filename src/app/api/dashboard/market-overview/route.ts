import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { marketSignals, collectionItems } from '@/storage/database/shared/schema';
import { eq, and, sql, count, desc, gte, countDistinct } from 'drizzle-orm';
import { cache } from '@/lib/cache/memory-cache';

// 缓存时间：10分钟
const CACHE_TTL = 600;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const platform = searchParams.get('platform') || 'ozon';
    const shopId = searchParams.get('shopId');

    // 构建缓存key
    const cacheKey = `market-overview:${platform}:${shopId || 'all'}`;

    // 尝试从缓存获取
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return NextResponse.json({ success: true, data: cachedData, cached: true });
    }

    // 转换平台参数
    const sourceType = platform === 'wb' ? 'wb' : 'ozon_market';

    // 构建查询条件
    const baseConditions = [eq(marketSignals.sourceType, sourceType)];
    if (shopId) {
      baseConditions.push(eq(marketSignals.shopId, shopId));
    }

    // 获取统计数据
    const [
      totalProductsResult,
      todayStart,
      yesterdayStart,
    ] = await Promise.all([
      // 总商品数
      db
        .select({ count: countDistinct(marketSignals.productId) })
        .from(marketSignals)
        .where(and(...baseConditions)),
      // 今天开始时间
      Promise.resolve(new Date(new Date().setHours(0, 0, 0, 0))),
      // 昨天开始时间
      Promise.resolve(new Date(Date.now() - 86400000)),
    ]);

    // 新增今日商品数
    const newTodayResult = await db
      .select({ count: count() })
      .from(marketSignals)
      .where(
        and(
          ...baseConditions,
          gte(marketSignals.collectedAt, todayStart)
        )
      );

    // 价格变化（今日vs昨日）
    const [todayAvgResult, yesterdayAvgResult] = await Promise.all([
      db
        .select({
          avgPrice: sql<string>`AVG(CAST(${marketSignals.price} AS DECIMAL))`,
        })
        .from(marketSignals)
        .where(
          and(
            ...baseConditions,
            gte(marketSignals.collectedAt, todayStart)
          )
        ),
      db
        .select({
          avgPrice: sql<string>`AVG(CAST(${marketSignals.price} AS DECIMAL))`,
        })
        .from(marketSignals)
        .where(
          and(
            ...baseConditions,
            gte(marketSignals.collectedAt, yesterdayStart),
            gte(marketSignals.collectedAt, todayStart)
          )
        ),
    ]);

    // 热销类目Top5
    const hotCategoriesResult = await db
      .select({
        category: marketSignals.categoryPath,
        count: count(),
        avgPrice: sql<string>`AVG(CAST(${marketSignals.price} AS DECIMAL))`,
        totalSales: sql<string>`SUM(${marketSignals.salesVolume})`,
      })
      .from(marketSignals)
      .where(and(...baseConditions, sql`${marketSignals.categoryPath} IS NOT NULL`))
      .groupBy(marketSignals.categoryPath)
      .orderBy(desc(count()))
      .limit(5);

    // 销量趋势（近30天）
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
    const salesTrendResult = await db
      .select({
        date: sql<string>`DATE(${marketSignals.collectedAt})`,
        totalSales: sql<string>`SUM(${marketSignals.salesVolume})`,
        count: count(),
      })
      .from(marketSignals)
      .where(and(...baseConditions, gte(marketSignals.collectedAt, thirtyDaysAgo)))
      .groupBy(sql`DATE(${marketSignals.collectedAt})`)
      .orderBy(sql`DATE(${marketSignals.collectedAt})`);

    // 热销店铺Top5
    const topShopsResult = await db
      .select({
        sellerName: marketSignals.sellerName,
        count: count(),
        totalSales: sql<string>`SUM(${marketSignals.salesVolume})`,
      })
      .from(marketSignals)
      .where(and(...baseConditions, sql`${marketSignals.sellerName} IS NOT NULL`))
      .groupBy(marketSignals.sellerName)
      .orderBy(desc(count()))
      .limit(5);

    // 平均利润率
    const avgProfitRateResult = await db
      .select({
        avgProfitRate: sql<string>`AVG(CAST(${marketSignals.profitRate} AS DECIMAL))`,
      })
      .from(marketSignals)
      .where(
        and(
          ...baseConditions,
          sql`${marketSignals.profitRate} IS NOT NULL`
        )
      );

    // 组装数据
    const todayAvgPrice = parseFloat(todayAvgResult[0]?.avgPrice || '0');
    const yesterdayAvgPrice = parseFloat(yesterdayAvgResult[0]?.avgPrice || '0');
    const priceChange = yesterdayAvgPrice > 0
      ? ((todayAvgPrice - yesterdayAvgPrice) / yesterdayAvgPrice * 100).toFixed(2)
      : '0';

    const data = {
      totalProducts: Number(totalProductsResult[0]?.count || 0),
      newToday: Number(newTodayResult[0]?.count || 0),
      priceChanges: parseFloat(priceChange),
      hotCategories: hotCategoriesResult.map((row) => ({
        category: row.category,
        productCount: Number(row.count),
        avgPrice: parseFloat(row.avgPrice || '0'),
        totalSales: Number(row.totalSales || 0),
      })),
      salesTrend: salesTrendResult.map((row) => ({
        date: row.date,
        totalSales: Number(row.totalSales || 0),
        count: Number(row.count),
      })),
      topShops: topShopsResult.map((row) => ({
        sellerName: row.sellerName,
        productCount: Number(row.count),
        totalSales: Number(row.totalSales || 0),
      })),
      avgProfitRate: parseFloat(avgProfitRateResult[0]?.avgProfitRate || '0'),
    };

    // 存入缓存
    cache.set(cacheKey, data, CACHE_TTL);

    return NextResponse.json({ success: true, data, cached: false });
  } catch (error) {
    console.error('[MarketOverview] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch market overview' },
      { status: 500 }
    );
  }
}
