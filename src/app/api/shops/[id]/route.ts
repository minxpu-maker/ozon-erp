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
    const { shopName, isActive, ozonClientId, ozonApiKey } = body;

    // 记录更新前的店铺名称（用于同步 orders 表）
    let oldShopName = '';
    if (shopName !== undefined) {
      const existingShop = await db
        .select({ name: shops.name })
        .from(shops)
        .where(eq(shops.id, id))
        .limit(1);
      if (existingShop.length > 0) {
        oldShopName = existingShop[0].name || '';
      }
    }
    
    // 构建更新字段
    const updateFields: string[] = [];
    const params2: (string | boolean | null)[] = [];
    
    if (shopName !== undefined) {
      updateFields.push(`name = $${params2.length + 1}`);
      params2.push(shopName);
    }
    if (isActive !== undefined) {
      updateFields.push(`is_active = $${params2.length + 1}`);
      params2.push(isActive);
    }
    if (ozonClientId !== undefined) {
      updateFields.push(`ozon_client_id = $${params2.length + 1}`);
      params2.push(ozonClientId || null);
    }
    if (ozonApiKey !== undefined) {
      updateFields.push(`ozon_api_key = $${params2.length + 1}`);
      params2.push(ozonApiKey || null);
    }
    
    updateFields.push(`updated_at = NOW()`);
    params2.push(id);

    await db.execute(sql`
      UPDATE shops 
      SET ${sql.raw(updateFields.join(', '))}
      WHERE id = $${params2.length}
    `);

    // 【关键】同步更新 orders 表的店铺名称
    if (shopName !== undefined && oldShopName && oldShopName !== shopName) {
      await db.execute(sql`
        UPDATE orders SET shop_name = ${shopName} WHERE shop_name = ${oldShopName}
      `);
      console.log(`[Shop Sync] 同步更新订单店铺名称: ${oldShopName} -> ${shopName}`);
    }

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

    const shopName = shop[0].name || '';

    // 软删除：将 is_active 设为 false
    await db.execute(sql`
      UPDATE shops SET is_active = false, updated_at = NOW() WHERE id = ${id}
    `);

    // 【关键】同步更新 orders 表的店铺名称（标记为已删除店铺）
    if (shopName) {
      await db.execute(sql`
        UPDATE orders SET shop_name = ${shopName + ' (已删除)'} WHERE shop_name = ${shopName}
      `);
      console.log(`[Shop Sync] 同步更新已删除店铺的订单: ${shopName}`);
    }

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
