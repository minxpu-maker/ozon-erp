import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { marketSignals } from '@/storage/database/shared/schema';
import { eq, and, sql, desc, gte, like } from 'drizzle-orm';
import { cache } from '@/lib/cache/memory-cache';

// 缓存时间：10分钟
const CACHE_TTL = 600;

// 常见俄语停用词
const STOP_WORDS = new Set([
  'и', 'в', 'не', 'на', 'что', 'он', 'с', 'как', 'а', 'то', 'все', 'она',
  'так', 'его', 'но', 'да', 'ты', 'к', 'у', 'же', 'вы', 'за', 'бы', 'по',
  'только', 'ее', 'мне', 'было', 'вот', 'от', 'меня', 'еще', 'нет', 'о',
  'из', 'ему', 'теперь', 'когда', 'уже', 'вам', 'ни', 'быть', 'был', 'него',
  'до', 'вас', 'нибудь', 'опять', 'уж', 'вам', 'сказал', 'ведь', 'там',
  'потом', 'себя', 'ничего', 'ей', 'может', 'они', 'тут', 'где', 'есть',
  'надо', 'ней', 'для', 'мы', 'тебя', 'их', 'чем', 'была', 'сам', 'чтоб',
  'без', 'будто', 'чего', 'раз', 'также', 'себе', 'под', 'жизнь', 'будет',
  'тогда', 'кто', 'этот', 'говорил', 'это', 'как', 'так', 'и', 'в', 'на',
  'с', 'по', 'к', 'для', 'от', 'за', 'из', 'о', 'об', 'со', 'под', 'при',
]);

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const platform = searchParams.get('platform') || 'ozon';
    const limit = parseInt(searchParams.get('limit') || '20');

    // 构建缓存key
    const cacheKey = `search-trending:${platform}:${limit}`;

    // 尝试从缓存获取
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return NextResponse.json({ success: true, data: cachedData, cached: true });
    }

    // 转换平台参数
    const sourceType = platform === 'wb' ? 'wb' : 'ozon_market';

    // 获取近7天和14-21天的数据进行对比
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
    const twentyOneDaysAgo = new Date(Date.now() - 21 * 86400000);
    const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000);

    // 获取近7天数据
    const recentProducts = await db
      .select({
        productId: marketSignals.productId,
        title: marketSignals.productTitle,
        category: marketSignals.categoryPath,
        sales: marketSignals.salesVolume,
      })
      .from(marketSignals)
      .where(and(
        eq(marketSignals.sourceType, sourceType),
        gte(marketSignals.collectedAt, sevenDaysAgo),
        sql`${marketSignals.productTitle} IS NOT NULL`
      ))
      .limit(500);

    // 获取14-21天数据（对比基准）
    const olderProducts = await db
      .select({
        productId: marketSignals.productId,
        title: marketSignals.productTitle,
        sales: marketSignals.salesVolume,
      })
      .from(marketSignals)
      .where(and(
        eq(marketSignals.sourceType, sourceType),
        gte(marketSignals.collectedAt, twentyOneDaysAgo),
        gte(marketSignals.collectedAt, fourteenDaysAgo),
        sql`${marketSignals.productTitle} IS NOT NULL`
      ))
      .limit(500);

    // 从标题中提取关键词并统计
    const recentKeywords = new Map<string, { count: number; sales: number; products: Set<string> }>();
    const olderKeywords = new Map<string, { count: number; sales: number }>();

    // 提取关键词函数
    const extractKeywords = (title: string | null): string[] => {
      if (!title) return [];
      // 移除特殊字符，转为小写，按空格/标点分割
      const words = title
        .toLowerCase()
        .replace(/[^\w\sа-яёА-ЯЁa-zA-Z]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 2 && !STOP_WORDS.has(word));
      return [...new Set(words)]; // 去重
    };

    // 统计近期关键词
    for (const product of recentProducts) {
      const keywords = extractKeywords(product.title);
      for (const keyword of keywords) {
        const existing = recentKeywords.get(keyword) || {
          count: 0,
          sales: 0,
          products: new Set()
        };
        existing.count++;
        existing.sales += Number(product.sales || 0);
        existing.products.add(product.productId);
        recentKeywords.set(keyword, existing);
      }
    }

    // 统计对比期关键词
    for (const product of olderProducts) {
      const keywords = extractKeywords(product.title);
      for (const keyword of keywords) {
        const existing = olderKeywords.get(keyword) || { count: 0, sales: 0 };
        existing.count++;
        existing.sales += Number(product.sales || 0);
        olderKeywords.set(keyword, existing);
      }
    }

    // 计算增长并排序
    const trendingKeywords: Array<{
      keyword: string;
      searchVolume: number;
      growth: number;
      relatedProducts: number;
      avgSales: number;
    }> = [];

    for (const [keyword, recentData] of recentKeywords) {
      const olderData = olderKeywords.get(keyword);
      const olderCount = olderData?.count || 0;

      // 增长率：(近期数量 - 对比期数量) / 对比期数量 * 100
      // 如果对比期为0但近期有数据，增长率为100%
      const growth = olderCount > 0
        ? ((recentData.count - olderCount) / olderCount * 100)
        : recentData.count > 0 ? 100 : 0;

      // 只保留近期出现3次以上的关键词，且有正增长
      if (recentData.count >= 3 && growth > 0) {
        trendingKeywords.push({
          keyword,
          searchVolume: recentData.count,
          growth: Math.round(growth * 100) / 100,
          relatedProducts: recentData.products.size,
          avgSales: Math.round(recentData.sales / recentData.count),
        });
      }
    }

    // 按增长率降序排序，取Top N
    trendingKeywords.sort((a, b) => b.growth - a.growth);
    const data = trendingKeywords.slice(0, limit);

    // 存入缓存
    cache.set(cacheKey, data, CACHE_TTL);

    return NextResponse.json({ success: true, data, cached: false });
  } catch (error) {
    console.error('[SearchTrending] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch search trending' },
      { status: 500 }
    );
  }
}
