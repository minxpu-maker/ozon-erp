/**
 * 关键词反查API
 * GET /api/keywords/reverse?productId=xxx
 * 
 * 返回指定商品的关联关键词列表
 * 关键词来源：title（标题）、tag（标签）、category（类目路径）
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { marketSignals, keywordReverse } from '@/storage/database/shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');
    const platform = searchParams.get('platform');

    if (!productId) {
      return NextResponse.json(
        { success: false, error: '缺少productId参数' },
        { status: 400 }
      );
    }

    // 查询指定商品
    let productQuery;
    if (platform && platform !== 'all') {
      // 如果指定了平台，按平台查询
      productQuery = db
        .select()
        .from(marketSignals)
        .where(and(
          eq(marketSignals.productId, productId),
          eq(marketSignals.sourceType, platform)
        ))
        .limit(1);
    } else {
      // 如果未指定平台，查询任意平台的商品
      productQuery = db
        .select()
        .from(marketSignals)
        .where(eq(marketSignals.productId, productId))
        .limit(1);
    }
    
    const products = await productQuery;
    const product = products[0] || null;

    if (!product) {
      return NextResponse.json({
        success: true,
        data: [],
        message: '未找到该商品的数据',
        cached: false,
      });
    }

    const signalId = product.id;

    // 1. 先查询缓存的关键词反查结果
    const cachedResults = await db
      .select()
      .from(keywordReverse)
      .where(eq(keywordReverse.signalId, signalId))
      .orderBy(desc(keywordReverse.searchVolume));

    if (cachedResults.length > 0) {
      // 返回缓存结果
      return NextResponse.json({
        success: true,
        data: cachedResults.map(item => ({
          keyword: item.keyword,
          searchVolume: item.searchVolume,
          competition: formatCompetition(item.competition ? Number(item.competition) : null),
          competitionValue: item.competition ? Number(item.competition) : null,
          rankPosition: item.rankPosition ?? 0,
          source: item.source,
        })),
        productId,
        cached: true,
      });
    }

    // 2. 无缓存，从商品信息提取关键词
    const extractedKeywords: Array<{
      keyword: string;
      searchVolume: number | null;
      competition: number | null;
      rankPosition: number;
      source: 'title' | 'tag' | 'category';
    }> = [];

    // 2.1 从标题提取关键词
    if (product.productTitle) {
      const titleKeywords = extractKeywordsFromText(product.productTitle, 'title');
      extractedKeywords.push(...titleKeywords);
    }

    // 2.2 从类目路径提取关键词
    if (product.categoryPath) {
      const categoryKeywords = extractKeywordsFromCategory(product.categoryPath);
      extractedKeywords.push(...categoryKeywords);
    }

    // 3. 去重并合并（同一关键词只保留一个，取较高优先级来源）
    const uniqueKeywords = mergeKeywords(extractedKeywords);

    // 4. 保存到 keyword_reverse 表
    if (uniqueKeywords.length > 0) {
      await db.insert(keywordReverse).values(
        uniqueKeywords.map((kw) => ({
          signalId: signalId,
          keyword: kw.keyword,
          searchVolume: kw.searchVolume,
          competition: kw.competition !== null ? String(kw.competition) : null,
          rankPosition: kw.rankPosition,
          source: kw.source,
        }))
      );
    }

    // 5. 按搜索量排序并返回
    uniqueKeywords.sort((a, b) => {
      const aVol = a.searchVolume || 0;
      const bVol = b.searchVolume || 0;
      return bVol - aVol;
    });

    return NextResponse.json({
      success: true,
      data: uniqueKeywords.slice(0, 20).map(item => ({
        keyword: item.keyword,
        searchVolume: item.searchVolume,
        competition: formatCompetition(item.competition),
        competitionValue: item.competition,
        rankPosition: item.rankPosition,
        source: item.source,
      })),
      productId,
      cached: false,
    });
  } catch (error) {
    console.error('关键词反查失败:', error);
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    );
  }
}

/**
 * 从文本中提取关键词（俄语分词）
 */
function extractKeywordsFromText(
  text: string,
  source: 'title' | 'tag' | 'category'
): Array<{
  keyword: string;
  searchVolume: number | null;
  competition: number | null;
  rankPosition: number;
  source: 'title' | 'tag' | 'category';
}> {
  // 俄语停用词
  const stopWords = new Set([
    'и', 'в', 'на', 'с', 'по', 'для', 'к', 'за', 'из', 'от', 'о', 'у', 'при',
    'из', 'что', 'как', 'не', 'но', 'да', 'же', 'ли', 'быть', 'это', 'то',
    'все', 'она', 'он', 'оно', 'они', 'я', 'мы', 'вы', 'ты', 'есмь', 'суть',
    'был', 'была', 'было', 'были', 'будет', 'будут', 'есть', 'нет', 'ни',
    'или', 'а', 'со', 'до', 'без', 'под', 'над', 'между', 'также', 'тоже',
    'только', 'уже', 'еще', 'ещё', 'очень', 'самый', 'более', 'менее',
    'через', 'после', 'перед', 'около', 'вокруг', 'вдоль', 'против',
    'внутри', 'снаружи', 'среди', 'вследствие', 'несмотря', 'вместо',
  ]);

  // 清理文本
  const cleaned = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // 俄语分词：按空格、连字符、数字边界切分
  const words = cleaned.split(/[\s-]+/).filter(word => {
    if (word.length < 3) return false;
    if (stopWords.has(word)) return false;
    // 过滤纯数字
    if (/^\d+$/.test(word)) return false;
    return true;
  });

  // 提取2-4词的短语组合
  const phrases: string[] = [];
  const wordList = cleaned.split(/[\s-]+/);
  
  // 提取连续词组（2-3词）
  for (let i = 0; i < wordList.length - 1; i++) {
    if (wordList[i].length >= 3 && wordList[i + 1].length >= 3) {
      if (!stopWords.has(wordList[i]) && !stopWords.has(wordList[i + 1])) {
        phrases.push(`${wordList[i]} ${wordList[i + 1]}`);
      }
    }
  }

  // 合并单词和短语
  const allKeywords = [...words.slice(0, 8), ...phrases.slice(0, 5)];

  // 去重
  const uniqueKeywords = [...new Set(allKeywords)];

  return uniqueKeywords.map((keyword, index) => ({
    keyword,
    searchVolume: null,
    competition: null,
    rankPosition: index + 1,
    source,
  }));
}

/**
 * 从类目路径提取关键词
 */
function extractKeywordsFromCategory(
  categoryPath: string
): Array<{
  keyword: string;
  searchVolume: number | null;
  competition: number | null;
  rankPosition: number;
  source: 'title' | 'tag' | 'category';
}> {
  const parts = categoryPath.split('/').filter(Boolean);
  
  return parts.map((part, index) => ({
    keyword: part.toLowerCase(),
    searchVolume: null,
    competition: null,
    rankPosition: index + 1,
    source: 'category' as const,
  }));
}

/**
 * 合并重复关键词，保留较高优先级来源
 */
function mergeKeywords(
  keywords: Array<{
    keyword: string;
    searchVolume: number | null;
    competition: number | null;
    rankPosition: number;
    source: 'title' | 'tag' | 'category';
  }>
): Array<{
  keyword: string;
  searchVolume: number | null;
  competition: number | null;
  rankPosition: number;
  source: 'title' | 'tag' | 'category';
}> {
  const sourcePriority: Record<string, number> = {
    title: 1,
    tag: 2,
    category: 3,
  };

  const map = new Map<string, typeof keywords[0]>();
  
  for (const kw of keywords) {
    const existing = map.get(kw.keyword);
    if (!existing) {
      map.set(kw.keyword, kw);
    } else if (sourcePriority[kw.source] < sourcePriority[existing.source]) {
      map.set(kw.keyword, kw);
    }
  }

  return Array.from(map.values());
}

/**
 * 格式化竞争度为标签
 */
function formatCompetition(value: number | null): 'low' | 'medium' | 'high' | 'unknown' {
  if (value === null) return 'unknown';
  if (value < 0.3) return 'low';
  if (value < 0.6) return 'medium';
  return 'high';
}
