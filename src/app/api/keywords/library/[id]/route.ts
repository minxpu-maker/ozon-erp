import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { keywordLibrary } from '@/storage/database/shared/schema';
import { eq, sql } from 'drizzle-orm';

/**
 * GET /api/keywords/library/:id
 * 获取单个关键词
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const keywordId = parseInt(id, 10);

    if (isNaN(keywordId)) {
      return NextResponse.json(
        { success: false, error: '无效的ID' },
        { status: 400 }
      );
    }

    const result = await db.execute(sql`
      SELECT id, keyword, platform, group_name, is_favorite, created_at
      FROM keyword_library
      WHERE id = ${keywordId}
      LIMIT 1
    `);

    if ((result.rows as Array<Record<string, unknown>>).length === 0) {
      return NextResponse.json(
        { success: false, error: '关键词不存在' },
        { status: 404 }
      );
    }

    const row = result.rows[0] as Record<string, unknown>;

    return NextResponse.json({
      success: true,
      data: {
        id: row.id,
        keyword: row.keyword,
        platform: row.platform,
        groupName: row.group_name,
        isFavorite: row.is_favorite,
        createdAt: row.created_at,
      },
    });
  } catch (error) {
    console.error('[keywords/library/:id GET] Error:', error);
    return NextResponse.json(
      { success: false, error: '获取关键词失败' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/keywords/library/:id
 * 更新关键词（分组/收藏状态）
 * Body: { groupName?: string, isFavorite?: boolean }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const keywordId = parseInt(id, 10);
    const body = await request.json();

    if (isNaN(keywordId)) {
      return NextResponse.json(
        { success: false, error: '无效的ID' },
        { status: 400 }
      );
    }

    const { groupName, isFavorite } = body;

    // 检查是否存在
    const existing = await db.execute(sql`
      SELECT id FROM keyword_library WHERE id = ${keywordId} LIMIT 1
    `);
    
    if ((existing.rows as Array<{ id: number }>).length === 0) {
      return NextResponse.json(
        { success: false, error: '关键词不存在' },
        { status: 404 }
      );
    }

    // 构建UPDATE语句
    const setClauses: string[] = [];
    if (typeof groupName === 'string') {
      setClauses.push(`group_name = '${groupName.replace(/'/g, "''")}'`);
    }
    if (typeof isFavorite === 'boolean') {
      setClauses.push(`is_favorite = ${isFavorite}`);
    }

    if (setClauses.length === 0) {
      return NextResponse.json(
        { success: false, error: '没有需要更新的字段' },
        { status: 400 }
      );
    }

    const result = await db.execute(sql`
      UPDATE keyword_library
      SET ${sql.raw(setClauses.join(', '))}
      WHERE id = ${keywordId}
      RETURNING id, keyword, platform, group_name, is_favorite, created_at
    `);

    const row = result.rows[0] as Record<string, unknown>;

    return NextResponse.json({
      success: true,
      data: {
        id: row.id,
        keyword: row.keyword,
        platform: row.platform,
        groupName: row.group_name,
        isFavorite: row.is_favorite,
        createdAt: row.created_at,
      },
    });
  } catch (error) {
    console.error('[keywords/library/:id PATCH] Error:', error);
    return NextResponse.json(
      { success: false, error: '更新关键词失败' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/keywords/library/:id
 * 删除关键词
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const keywordId = parseInt(id, 10);

    if (isNaN(keywordId)) {
      return NextResponse.json(
        { success: false, error: '无效的ID' },
        { status: 400 }
      );
    }

    const result = await db.execute(sql`
      DELETE FROM keyword_library
      WHERE id = ${keywordId}
      RETURNING id
    `);

    if ((result.rows as Array<{ id: number }>).length === 0) {
      return NextResponse.json(
        { success: false, error: '关键词不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '删除成功',
    });
  } catch (error) {
    console.error('[keywords/library/:id DELETE] Error:', error);
    return NextResponse.json(
      { success: false, error: '删除关键词失败' },
      { status: 500 }
    );
  }
}
