import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/storage/database/client';
import { eq, sql } from 'drizzle-orm';

// 获取所有分组
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || 'default';

    // 使用原始 SQL 避免列名映射问题
    const groups = await db.execute(sql`
      SELECT pg.*, 
        COALESCE((SELECT COUNT(*) FROM product_group_items pgi WHERE pgi.group_id = pg.id), 0) as product_count
      FROM product_groups pg
      WHERE pg.user_id = ${userId} OR pg.user_id IS NULL
      ORDER BY pg.created_at ASC
    `);

    const data = groups.rows.map((row: Record<string, unknown>) => ({
      id: row.id,
      userId: row.user_id,
      name: row.name,
      sortOrder: row.sort_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      productCount: Number(row.product_count) || 0,
    }));

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('获取分组失败:', error);
    return NextResponse.json(
      { success: false, error: '获取分组失败' },
      { status: 500 }
    );
  }
}

// 创建新分组
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, userId } = body;

    if (!name) {
      return NextResponse.json(
        { success: false, error: '分组名称不能为空' },
        { status: 400 }
      );
    }

    const result = await db.execute(sql`
      INSERT INTO product_groups (user_id, name)
      VALUES (${userId || 'default'}, ${name})
      RETURNING *
    `);

    const row = result.rows[0] as Record<string, unknown>;

    return NextResponse.json({
      success: true,
      data: {
        id: row.id,
        userId: row.user_id,
        name: row.name,
        sortOrder: row.sort_order,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    });
  } catch (error) {
    console.error('创建分组失败:', error);
    return NextResponse.json(
      { success: false, error: '创建分组失败' },
      { status: 500 }
    );
  }
}
