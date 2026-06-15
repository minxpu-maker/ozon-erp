import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { keywordLibrary } from '@/storage/database/shared/schema';
import { eq, and, like, sql } from 'drizzle-orm';

/**
 * GET /api/keywords/library
 * 获取关键词库列表
 * 
 * Query: platform=ozon&group=xxx&favorite=true&page=1&pageSize=50
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get('platform') || 'ozon';
    const group = searchParams.get('group');
    const favorite = searchParams.get('favorite');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '50', 10);
    const offset = (page - 1) * pageSize;

    // 构建查询条件
    const conditions = [eq(keywordLibrary.platform, platform)];
    
    if (group) {
      conditions.push(eq(keywordLibrary.groupName, group));
    }
    
    if (favorite === 'true') {
      conditions.push(eq(keywordLibrary.isFavorite, true));
    }

    // 获取总数
    const countResult = await db.execute(sql`
      SELECT COUNT(*) as total FROM keyword_library
      WHERE platform = ${platform}
        ${group ? sql`AND group_name = ${group}` : sql``}
        ${favorite === 'true' ? sql`AND is_favorite = true` : sql``}
    `);
    const total = Number((countResult.rows[0] as { total: string }).total) || 0;

    // 获取列表
    const result = await db.execute(sql`
      SELECT 
        id, keyword, platform, group_name, is_favorite, created_at
      FROM keyword_library
      WHERE platform = ${platform}
        ${group ? sql`AND group_name = ${group}` : sql``}
        ${favorite === 'true' ? sql`AND is_favorite = true` : sql``}
      ORDER BY is_favorite DESC, created_at DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `);

    const items = result.rows.map((row: Record<string, unknown>) => ({
      id: row.id,
      keyword: row.keyword,
      platform: row.platform,
      groupName: row.group_name,
      isFavorite: row.is_favorite,
      createdAt: row.created_at,
    }));

    return NextResponse.json({
      success: true,
      data: items,
      total,
      page,
      pageSize,
    });
  } catch (error) {
    console.error('[keywords/library GET] Error:', error);
    return NextResponse.json(
      { success: false, error: '获取关键词库失败' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/keywords/library
 * 添加关键词到词库
 * Body: { keyword: string, group?: string, platform?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { keyword, group, platform = 'ozon' } = body;

    if (!keyword || typeof keyword !== 'string' || !keyword.trim()) {
      return NextResponse.json(
        { success: false, error: '关键词不能为空' },
        { status: 400 }
      );
    }

    const trimmedKeyword = keyword.trim().toLowerCase();

    // 检查是否已存在
    const existing = await db.execute(sql`
      SELECT id FROM keyword_library
      WHERE LOWER(keyword) = ${trimmedKeyword} AND platform = ${platform}
      LIMIT 1
    `);

    if ((existing.rows as Array<{ id: number }>).length > 0) {
      return NextResponse.json(
        { success: false, error: '关键词已存在' },
        { status: 409 }
      );
    }

    // 插入新关键词
    const result = await db.execute(sql`
      INSERT INTO keyword_library (keyword, platform, group_name)
      VALUES (${trimmedKeyword}, ${platform}, ${group || null})
      RETURNING id, keyword, platform, group_name, is_favorite, created_at
    `);

    const newItem = result.rows[0] as Record<string, unknown>;

    return NextResponse.json({
      success: true,
      data: {
        id: newItem.id,
        keyword: newItem.keyword,
        platform: newItem.platform,
        groupName: newItem.group_name,
        isFavorite: newItem.is_favorite,
        createdAt: newItem.created_at,
      },
    });
  } catch (error) {
    console.error('[keywords/library POST] Error:', error);
    return NextResponse.json(
      { success: false, error: '添加关键词失败' },
      { status: 500 }
    );
  }
}
