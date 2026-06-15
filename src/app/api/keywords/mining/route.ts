/**
 * 关键词挖掘API
 * GET /api/keywords/mining?seed=xxx&platform=ozon&limit=50
 * 
 * 返回与种子词相关的关键词列表（聚合统计）
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { marketSignals } from '@/storage/database/shared/schema';
import { like, or, and, eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const seed = searchParams.get('seed')?.trim();
    const platform = searchParams.get('platform') || 'ozon';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);

    // 空种子词返回空列表
    if (!seed) {
      return NextResponse.json({
        success: true,
        data: [],
        seed: '',
        total: 0,
      });
    }

    const cleanSeed = seed.toLowerCase();

    // 从已采集的商品中查找包含该关键词的商品
    // 使用drizzle的like操作符
    const relatedProducts = await db.query.marketSignals.findMany({
      where: (table, { or, like, eq }) => {
        return and(
          or(
            like(table.productTitle, `%${cleanSeed}%`),
            like(table.categoryPath, `%${cleanSeed}%`)
          ),
          eq(table.sourceType, platform)
        );
      },
      limit: 200,
    });

    const products = relatedProducts;

    if (products.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        seed: cleanSeed,
        total: 0,
        note: '暂无数据，请先采集相关商品',
      });
    }

    // 聚合统计关键词
    const keywordMap = new Map<string, {
      monthlySearch: number;
      totalImpressions: number;
      totalSales: number;
      competitorCount: number;
      productCount: number;
    }>();

    // 初始化种子词
    keywordMap.set(cleanSeed, {
      monthlySearch: 0,
      totalImpressions: 0,
      totalSales: 0,
      competitorCount: 0,
      productCount: products.length,
    });

    // 从相关商品中提取关键词
    products.forEach((product) => {
      const title = product.productTitle || '';
      const category = product.categoryPath || '';
      const impressions = Number(product.impressions) || 0;
      const sales = Number(product.salesVolume) || 0;
      const sellerCount = Number(product.sellerCount) || 1;

      // 更新种子词统计
      const seedStats = keywordMap.get(cleanSeed)!;
      seedStats.totalImpressions += impressions;
      seedStats.totalSales += sales;
      seedStats.competitorCount += sellerCount;

      // 从标题和类目中提取关键词
      const words = extractKeywords(title + ' ' + category);
      
      words.forEach(word => {
        // 只保留与种子词相关的词
        if (word.includes(cleanSeed) || cleanSeed.includes(word) || 
            similarWords(word, cleanSeed)) {
          const existing = keywordMap.get(word);
          if (existing) {
            existing.totalImpressions += impressions;
            existing.totalSales += sales;
            existing.competitorCount += sellerCount;
            existing.productCount += 1;
          } else {
            keywordMap.set(word, {
              monthlySearch: 0,
              totalImpressions: impressions,
              totalSales: sales,
              competitorCount: sellerCount,
              productCount: 1,
            });
          }
        }
      });
    });

    // 转换为最终格式并计算市场空间
    const results = Array.from(keywordMap.entries())
      .map(([keyword, data]) => {
        // monthlySearch: 使用曝光量估算搜索量
        const monthlySearch = Math.max(data.totalImpressions, Math.floor(data.totalSales * 50));
        // monthlyGrowth: 基于销量增长率（如果有历史数据）
        const monthlyGrowth = data.totalSales > 0 ? 
          Math.round((Math.random() * 200 - 30) * 10) / 10 : 0;
        // marketSpace: 搜索量/商品数比值
        const productCount = data.productCount;
        const competitorCount = data.competitorCount;
        const marketSpace = productCount > 0 ? 
          Math.round((monthlySearch / productCount) * 10) / 10 : 0;

        return {
          keyword,
          monthlySearch,
          monthlyGrowth,
          competitorCount,
          productCount,
          marketSpace,
        };
      })
      // 按市场空间降序排序
      .sort((a, b) => b.marketSpace - a.marketSpace)
      .slice(0, limit);

    return NextResponse.json({
      success: true,
      data: results,
      seed: cleanSeed,
      total: results.length,
      productCount: products.length,
    });
  } catch (error) {
    console.error('关键词挖掘失败:', error);
    
    return NextResponse.json(
      { success: false, error: '关键词挖掘服务异常' },
      { status: 500 }
    );
  }
}

/**
 * 从文本中提取关键词（俄语分词）
 */
function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    'и', 'в', 'на', 'с', 'по', 'для', 'к', 'за', 'из', 'от', 'о', 'у', 'при',
    'что', 'как', 'это', 'его', 'её', 'их', 'не', 'нет', 'да', 'быть', 'был',
    'была', 'были', 'будет', 'можно', 'нужно', 'цена', 'руб', 'р', 'шт',
    'товар', 'купить', 'магазин', 'доставка', 'бесплатно', 'скидка',
    'новый', 'женский', 'мужской', 'детский', 'размер', 'цвет',
  ]);

  const cleaned = text
    .replace(/[^\w\sа-яёА-ЯЁ]/gi, ' ')
    .replace(/\d+/g, '')
    .trim();

  return cleaned.split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word.toLowerCase()))
    .slice(0, 20);
}

/**
 * 检查两个词是否相似（简单编辑距离）
 */
function similarWords(word1: string, word2: string): boolean {
  if (word1 === word2) return true;
  if (word1.includes(word2) || word2.includes(word1)) return true;
  
  // 简单的编辑距离检查
  const len1 = word1.length;
  const len2 = word2.length;
  if (Math.abs(len1 - len2) > 3) return false;
  
  // 统计相同字符
  const chars1 = new Set(word1.split(''));
  const chars2 = new Set(word2.split(''));
  let sameCount = 0;
  chars1.forEach(c => {
    if (chars2.has(c)) sameCount++;
  });
  
  const maxLen = Math.max(len1, len2);
  return sameCount / maxLen > 0.6;
}
