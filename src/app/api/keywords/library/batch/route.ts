import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { sql } from 'drizzle-orm';

/**
 * POST /api/keywords/library/batch
 * 批量添加关键词到词库
 * Body: { keywords: string[], group?: string, platform?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { keywords, group, platform = 'ozon' } = body;

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json(
        { success: false, error: '关键词列表不能为空' },
        { status: 400 }
      );
    }

    // 去重并过滤空关键词
    const uniqueKeywords = [...new Set(
      keywords
        .filter((k: unknown) => typeof k === 'string' && k.trim())
        .map((k: string) => k.trim().toLowerCase())
    )];

    if (uniqueKeywords.length === 0) {
      return NextResponse.json(
        { success: false, error: '没有有效的关键词' },
        { status: 400 }
      );
    }

    // 检查已存在的关键词
    const existingResult = await db.execute(sql`
      SELECT LOWER(keyword) as kw FROM keyword_library
      WHERE platform = ${platform}
        AND LOWER(keyword) = ANY(ARRAY[${sql.join(uniqueKeywords.map(k => sql`${k}`), sql`, `)}]::text[])
    `);
    const existingKeywords = new Set((existingResult.rows as Array<{ kw: string }>).map(r => r.kw));
    const newKeywords = uniqueKeywords.filter(k => !existingKeywords.has(k));

    if (newKeywords.length === 0) {
      return NextResponse.json({
        success: true,
        data: { added: 0, skipped: uniqueKeywords.length, message: '所有关键词已存在' },
      });
    }

    // 构建批量插入语句
    const values = newKeywords.map(k => {
      const groupVal = group ? `'${group}'` : 'NULL';
      return `('${k}', '${platform}', ${groupVal})`;
    }).join(', ');

    const result = await db.execute(sql`
      INSERT INTO keyword_library (keyword, platform, group_name)
      VALUES ${sql.raw(values)}
      ON CONFLICT (keyword, platform) DO UPDATE SET group_name = EXCLUDED.group_name
      RETURNING id, keyword, platform, group_name, is_favorite, created_at
    `);

    const addedItems = result.rows.map((row: Record<string, unknown>) => ({
      id: row.id,
      keyword: row.keyword,
      platform: row.platform,
      groupName: row.group_name,
      isFavorite: row.is_favorite,
      createdAt: row.created_at,
    }));

    return NextResponse.json({
      success: true,
      data: {
        added: addedItems.length,
        skipped: existingKeywords.size,
        items: addedItems,
      },
    });
  } catch (error) {
    console.error('[keywords/library/batch POST] Error:', error);
    return NextResponse.json(
      { success: false, error: '批量添加关键词失败' },
      { status: 500 }
    );
  }
}
