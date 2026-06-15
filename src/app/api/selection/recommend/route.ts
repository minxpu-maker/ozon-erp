import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { marketSignals } from '@/storage/database/shared/schema';
import { sql, desc, asc, gt, lt, and, gte, lte, eq, count, or, isNull, isNotNull } from 'drizzle-orm';
import { cache } from '@/lib/cache/memory-cache';

// GET /api/selection/recommend
// 推荐模式查询：surge/potential/unsatisfied/low-stock
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || 'surge';
    const platform = searchParams.get('platform') || 'ozon';
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const offset = (page - 1) * pageSize;

    // 缓存key
    const cacheKey = `selection:recommend:${mode}:${platform}:${page}:${pageSize}`;
    
    // 尝试从缓存获取
    const cached = cache.get(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    // 平台映射
    const sourceType = platform === 'wb' ? 'wb' : 'ozon_market';

    // 计算时间范围
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    let result: any;

    switch (mode) {
      case 'surge':
        // 销量飙升榜：近7天销量增长率Top
        // 通过 previousSignalId 关联计算增长率
        result = await getSurgeProducts(sourceType, weekAgo, twoWeeksAgo, pageSize, offset);
        break;

      case 'potential':
        // 潜力市场：销量>0但卖家数<5的类目商品
        result = await getPotentialProducts(sourceType, pageSize, offset);
        break;

      case 'unsatisfied':
        // 未被满足：搜索量高但商品数少的类目
        result = await getUnsatisfiedProducts(sourceType, pageSize, offset);
        break;

      case 'low-stock':
        // 不压库存：FBS配送+轻量(<500g)+小体积商品
        result = await getLowStockProducts(sourceType, pageSize, offset);
        break;

      default:
        return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
    }

    // 缓存10分钟
    cache.set(cacheKey, result, 600); // 600秒 = 10分钟

    return NextResponse.json(result);
  } catch (error) {
    console.error('Selection recommend error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// 销量飙升榜：按销量增长率排序
async function getSurgeProducts(
  sourceType: string,
  weekAgo: Date,
  twoWeeksAgo: Date,
  limit: number,
  offset: number
) {
  // 获取近7天有销量的商品，按销量降序
  // 简化版：直接按销量和采集时间计算
  const products = await db
    .select({
      id: marketSignals.id,
      productId: marketSignals.productId,
      productTitle: marketSignals.productTitle,
      productTitleZh: marketSignals.productTitleZh,
      imageUrl: marketSignals.imageUrl,
      price: marketSignals.price,
      originalPrice: marketSignals.originalPrice,
      salesVolume: marketSignals.salesVolume,
      revenue: marketSignals.revenue,
      rating: marketSignals.rating,
      reviewsCount: marketSignals.reviewsCount,
      sellerCount: marketSignals.sellerCount,
      categoryPath: marketSignals.categoryPath,
      sourceType: marketSignals.sourceType,
      deliveryType: marketSignals.deliveryType,
      profitRate: marketSignals.profitRate,
      collectedAt: marketSignals.collectedAt,
      // 增长率计算：假设近7天销量/总销量比例作为增长指标
      growthScore: sql<number>`COALESCE(${marketSignals.salesVolume}, 0) * 
        CASE WHEN ${marketSignals.collectedAt} > ${weekAgo}::timestamp THEN 2.0 
             WHEN ${marketSignals.collectedAt} > ${twoWeeksAgo}::timestamp THEN 1.5 
             ELSE 1.0 END`.as('growth_score'),
    })
    .from(marketSignals)
    .where(
      and(
        eq(marketSignals.sourceType, sourceType),
        gt(marketSignals.salesVolume, 0)
      )
    )
    .orderBy(desc(sql`growth_score`), desc(marketSignals.salesVolume))
    .limit(limit)
    .offset(offset);

  // 计算总数
  const totalResult = await db
    .select({ count: count() })
    .from(marketSignals)
    .where(
      and(
        eq(marketSignals.sourceType, sourceType),
        gt(marketSignals.salesVolume, 0)
      )
    );

  return {
    items: products.map(p => ({
      ...p,
      growthRate: calculateGrowthRate(p.salesVolume, p.collectedAt),
    })),
    total: totalResult[0]?.count || 0,
    page: Math.floor(offset / limit) + 1,
    pageSize: limit,
    mode: 'surge',
  };
}

// 潜力市场：销量>0但卖家数<5
async function getPotentialProducts(
  sourceType: string,
  limit: number,
  offset: number
) {
  const products = await db
    .select({
      id: marketSignals.id,
      productId: marketSignals.productId,
      productTitle: marketSignals.productTitle,
      productTitleZh: marketSignals.productTitleZh,
      imageUrl: marketSignals.imageUrl,
      price: marketSignals.price,
      originalPrice: marketSignals.originalPrice,
      salesVolume: marketSignals.salesVolume,
      revenue: marketSignals.revenue,
      rating: marketSignals.rating,
      reviewsCount: marketSignals.reviewsCount,
      sellerCount: marketSignals.sellerCount,
      categoryPath: marketSignals.categoryPath,
      sourceType: marketSignals.sourceType,
      deliveryType: marketSignals.deliveryType,
      profitRate: marketSignals.profitRate,
      // 潜力分数：销量/卖家数（竞争小但有销量）
      potentialScore: sql<number>`CASE WHEN ${marketSignals.sellerCount} > 0 
        THEN CAST(${marketSignals.salesVolume} AS DECIMAL) / ${marketSignals.sellerCount} 
        ELSE ${marketSignals.salesVolume} END`.as('potential_score'),
    })
    .from(marketSignals)
    .where(
      and(
        eq(marketSignals.sourceType, sourceType),
        gt(marketSignals.salesVolume, 0),
        lt(marketSignals.sellerCount, 5)
      )
    )
    .orderBy(desc(sql`potential_score`))
    .limit(limit)
    .offset(offset);

  const totalResult = await db
    .select({ count: count() })
    .from(marketSignals)
    .where(
      and(
        eq(marketSignals.sourceType, sourceType),
        gt(marketSignals.salesVolume, 0),
        lt(marketSignals.sellerCount, 5)
      )
    );

  return {
    items: products,
    total: totalResult[0]?.count || 0,
    page: Math.floor(offset / limit) + 1,
    pageSize: limit,
    mode: 'potential',
  };
}

// 未被满足：基于类目统计，供需比高
async function getUnsatisfiedProducts(
  sourceType: string,
  limit: number,
  offset: number
) {
  try {
    // 按类目聚合，查找商品少但销量高的类目
    // 注意：categoryPath可能为null，需要先过滤
    const categoryStatsRaw = await db
      .select({
        categoryPath: marketSignals.categoryPath,
        productCount: count(),
        totalSales: sql<number>`SUM(COALESCE(${marketSignals.salesVolume}, 0))::float`,
        avgSales: sql<number>`AVG(COALESCE(${marketSignals.salesVolume}, 0))::float`,
      })
      .from(marketSignals)
      .where(and(
        eq(marketSignals.sourceType, sourceType),
        isNotNull(marketSignals.categoryPath)
      ))
      .groupBy(marketSignals.categoryPath)
      .limit(100);

    // 过滤并计算供需比
    const unsatisfiedCategories = categoryStatsRaw
      .filter(c => c.categoryPath && c.productCount && c.productCount > 0)
      .map(c => ({
        ...c,
        supplyDemandRatio: c.totalSales && c.productCount ? (Number(c.totalSales) / Number(c.productCount)) : 0,
      }))
      .sort((a, b) => b.supplyDemandRatio - a.supplyDemandRatio);

    return {
      items: unsatisfiedCategories.slice(offset, offset + limit).map((c, idx) => ({
        id: idx,
        categoryPath: c.categoryPath,
        productCount: c.productCount,
        totalSales: Number(c.totalSales),
        avgSales: Number(c.avgSales),
        supplyDemandRatio: c.supplyDemandRatio,
      })),
      total: unsatisfiedCategories.length,
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
      mode: 'unsatisfied',
    };
  } catch (error) {
    console.error('Unsatisfied products error:', error);
    throw error;
  }
}

// 不压库存：FBS配送+轻量(<500g)+小体积
async function getLowStockProducts(
  sourceType: string,
  limit: number,
  offset: number
) {
  const products = await db
    .select({
      id: marketSignals.id,
      productId: marketSignals.productId,
      productTitle: marketSignals.productTitle,
      productTitleZh: marketSignals.productTitleZh,
      imageUrl: marketSignals.imageUrl,
      price: marketSignals.price,
      originalPrice: marketSignals.originalPrice,
      salesVolume: marketSignals.salesVolume,
      revenue: marketSignals.revenue,
      rating: marketSignals.rating,
      reviewsCount: marketSignals.reviewsCount,
      sellerCount: marketSignals.sellerCount,
      categoryPath: marketSignals.categoryPath,
      sourceType: marketSignals.sourceType,
      deliveryType: marketSignals.deliveryType,
      weight: marketSignals.weight,
      volume: marketSignals.volume,
      profitRate: marketSignals.profitRate,
    })
    .from(marketSignals)
    .where(
      and(
        eq(marketSignals.sourceType, sourceType),
        // FBS配送
        sql`${marketSignals.deliveryType} IN ('FBS', 'RFBS')`,
        // 轻量商品 < 500g
        or(
          sql`CAST(${marketSignals.weight} AS DECIMAL) < 500`,
          isNull(marketSignals.weight)
        )
      )
    )
    .orderBy(desc(marketSignals.salesVolume))
    .limit(limit)
    .offset(offset);

  const totalResult = await db
    .select({ count: count() })
    .from(marketSignals)
    .where(
      and(
        eq(marketSignals.sourceType, sourceType),
        sql`${marketSignals.deliveryType} IN ('FBS', 'RFBS')`
      )
    );

  return {
    items: products,
    total: totalResult[0]?.count || 0,
    page: Math.floor(offset / limit) + 1,
    pageSize: limit,
    mode: 'low-stock',
  };
}

// 计算增长率（简化版）
function calculateGrowthRate(salesVolume: number | null, collectedAt: Date | null): number {
  if (!salesVolume || !collectedAt) return 0;
  const daysSinceCollected = (Date.now() - new Date(collectedAt).getTime()) / (24 * 60 * 60 * 1000);
  // 假设采集时销量为当前的一半，作为增长率估算
  return Math.round((salesVolume / Math.max(daysSinceCollected, 1)) * 100) / 100;
}
