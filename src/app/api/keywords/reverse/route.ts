/**
 * 关键词反查API
 * GET /api/keywords/reverse?productId=xxx
 * 
 * 返回指定商品的关联关键词列表
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { marketSignals } from '@/storage/database/shared/schema';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');

    if (!productId) {
      return NextResponse.json(
        { success: false, error: '缺少productId参数' },
        { status: 400 }
      );
    }

    // 查询指定商品
    const product = await db.query.marketSignals.findFirst({
      where: (table, { eq }) => eq(table.productId, productId),
    });

    if (!product) {
      // 没有找到商品，返回空数据
      return NextResponse.json({
        success: true,
        data: [],
        message: '未找到该商品的数据',
      });
    }

    // 从商品标题和类目路径中提取关键词
    const keywords: Array<{
      keyword: string;
      searchVolume: number;
      competition: 'low' | 'medium' | 'high';
      competitionValue: number;
      rank: number;
    }> = [];

    // 提取标题关键词
    if (product.productTitle) {
      // 俄语文本分词提取关键词
      const titleWords = extractKeywords(product.productTitle);
      titleWords.forEach((word, index) => {
        keywords.push({
          keyword: word,
          searchVolume: Math.floor(Math.random() * 50000) + 10000, // 模拟数据
          competition: index < 2 ? 'high' : index < 4 ? 'medium' : 'low',
          competitionValue: index < 2 ? 80 + Math.random() * 20 : index < 4 ? 40 + Math.random() * 40 : Math.random() * 40,
          rank: index + 1,
        });
      });
    }

    // 模拟从类目路径提取的关键词
    if (product.categoryPath) {
      const categoryParts = product.categoryPath.split('/').filter(Boolean);
      categoryParts.slice(-2).forEach((part, index) => {
        keywords.push({
          keyword: part.toLowerCase(),
          searchVolume: Math.floor(Math.random() * 30000) + 5000,
          competition: index === 0 ? 'high' : 'medium',
          competitionValue: index === 0 ? 70 + Math.random() * 30 : 30 + Math.random() * 40,
          rank: keywords.length + 1,
        });
      });
    }

    // 按搜索量排序
    keywords.sort((a, b) => b.searchVolume - a.searchVolume);

    return NextResponse.json({
      success: true,
      data: keywords.slice(0, 20),
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
 * 从俄语文本中提取关键词
 */
function extractKeywords(text: string): string[] {
  // 俄语停用词
  const stopWords = new Set([
    'и', 'в', 'на', 'с', 'по', 'для', 'к', 'за', 'из', 'от', 'о', 'у', 'при',
    'что', 'как', 'это', 'его', 'её', 'их', 'не', 'нет', 'да', 'быть', 'был',
    'была', 'были', 'будет', 'можно', 'нужно', 'цена', 'руб', 'р', 'шт', 'кг',
    'см', 'мм', 'мл', 'л', 'г', 'теплый', 'новый', 'размер', 'цвет', 'белый',
    'черный', 'синий', 'красный', 'зеленый', 'желтый', 'серый', 'коричневый',
  ]);

  // 清理文本
  const cleaned = text
    .replace(/[^\w\sа-яёА-ЯЁ]/gi, ' ')
    .replace(/\d+/g, '')
    .trim();

  // 分词
  const words = cleaned.split(/\s+/).filter(word => {
    return word.length > 3 && !stopWords.has(word.toLowerCase());
  });

  // 去重并返回
  return [...new Set(words)].slice(0, 10);
}
