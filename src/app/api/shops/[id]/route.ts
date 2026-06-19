/**
 * 店铺 API
 * GET /api/shops/[id]
 * PUT /api/shops/[id]
 * DELETE /api/shops/[id]
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { shops } from '@/storage/database/shared/schema';
import { eq } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

/**
 * GET /api/shops/[id]
 * 获取单个店铺详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const shop = await db
      .select()
      .from(shops)
      .where(eq(shops.id, id))
      .limit(1);

    if (shop.length === 0) {
      return NextResponse.json(
        { success: false, error: '店铺不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: shop[0],
    });
  } catch (error) {
    console.error('[Shops API] GET error:', error);
    return NextResponse.json(
      { success: false, error: '获取店铺信息失败' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/shops/[id]
 * 更新店铺信息
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { shopName, isActive } = body;

    // 使用原始 SQL 更新，因为 schema 字段名和数据库字段名不一致
    await db.execute(sql`
      UPDATE shops 
      SET name = ${shopName}, 
          is_active = ${isActive}, 
          updated_at = NOW()
      WHERE id = ${id}
    `);

    // 查询更新后的店铺
    const updated = await db
      .select()
      .from(shops)
      .where(eq(shops.id, id))
      .limit(1);

    if (updated.length === 0) {
      return NextResponse.json(
        { success: false, error: '店铺不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '店铺信息已更新',
      data: updated[0],
    });
  } catch (error) {
    console.error('[Shops API] PUT error:', error);
    return NextResponse.json(
      { success: false, error: '更新店铺信息失败' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/shops/[id]
 * 删除指定店铺
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 检查店铺是否存在
    const shop = await db
      .select()
      .from(shops)
      .where(eq(shops.id, id))
      .limit(1);

    if (shop.length === 0) {
      return NextResponse.json(
        { success: false, error: '店铺不存在' },
        { status: 404 }
      );
    }

    // 软删除：将 is_active 设为 false
    await db.execute(sql`
      UPDATE shops SET is_active = false, updated_at = NOW() WHERE id = ${id}
    `);

    return NextResponse.json({
      success: true,
      message: '店铺已删除',
    });
  } catch (error) {
    console.error('[Shops API] DELETE error:', error);
    return NextResponse.json(
      { success: false, error: '删除店铺失败' },
      { status: 500 }
    );
  }
}
