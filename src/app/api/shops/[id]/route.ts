/**
 * 店铺详情 API
 * GET /api/shops/[id] - 获取店铺详情
 * PUT /api/shops/[id] - 更新店铺信息
 * DELETE /api/shops/[id] - 软删除店铺
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { shops } from '@/storage/database/shared/schema';
import { eq } from 'drizzle-orm';
import { encrypt } from '@/lib/crypto';

// 更新店铺请求类型
interface UpdateShopBody {
  shopName?: string;
  ozonClientId?: string;
  ozonApiKey?: string;
  platform?: string;
}

/**
 * GET /api/shops/[id]
 * 获取单个店铺详情（不返回API密钥明文）
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 查询店铺
    const [shop] = await db
      .select()
      .from(shops)
      .where(eq(shops.id, id))
      .limit(1);

    if (!shop) {
      return NextResponse.json(
        { success: false, error: '店铺不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: shop.id,
        shopName: shop.name,
        platform: shop.platform,
        isActive: shop.is_active,
        ozonClientId: shop.client_id || shop.ozon_client_id,
        hasApiKey: !!(shop.api_key || shop.ozon_api_key),
        isPrimary: shop.is_primary,
        createdAt: shop.created_at,
        updatedAt: shop.updated_at,
      },
    });
  } catch (error) {
    console.error('[Shop Detail API] GET error:', error);
    return NextResponse.json(
      { success: false, error: '获取店铺详情失败' },
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
    const body: UpdateShopBody = await request.json();

    // 检查店铺是否存在
    const [existingShop] = await db
      .select()
      .from(shops)
      .where(eq(shops.id, id))
      .limit(1);

    if (!existingShop) {
      return NextResponse.json(
        { success: false, error: '店铺不存在' },
        { status: 404 }
      );
    }

    // 构建更新数据 - 使用主字段 client_id/api_key
    const updateData: Record<string, unknown> = {
      updated_at: new Date(),
    };

    // 需要重新测试连接的标记
    let connectionTestNeeded = false;

    if (body.shopName !== undefined) {
      if (!body.shopName.trim()) {
        return NextResponse.json(
          { success: false, error: '店铺名称不能为空' },
          { status: 400 }
        );
      }
      // 检查名称是否与其他店铺冲突
      const conflict = await db
        .select({ id: shops.id })
        .from(shops)
        .where(eq(shops.name, body.shopName.trim()))
        .limit(1);

      if (conflict.length > 0 && conflict[0].id !== id) {
        return NextResponse.json(
          { success: false, error: '店铺名称已存在' },
          { status: 409 }
        );
      }
      updateData.name = body.shopName.trim();
    }

    if (body.ozonClientId !== undefined) {
      if (!body.ozonClientId.trim()) {
        return NextResponse.json(
          { success: false, error: 'Ozon Client-ID 不能为空' },
          { status: 400 }
        );
      }
      updateData.client_id = body.ozonClientId.trim();
      connectionTestNeeded = true;
    }

    if (body.ozonApiKey !== undefined) {
      if (!body.ozonApiKey.trim()) {
        return NextResponse.json(
          { success: false, error: 'Ozon API-Key 不能为空' },
          { status: 400 }
        );
      }
      // 重新加密API密钥 - 使用主字段 api_key
      updateData.api_key = encrypt(body.ozonApiKey.trim());
      connectionTestNeeded = true;
    }

    if (body.platform !== undefined) {
      updateData.platform = body.platform;
    }

    // 执行更新
    const [updatedShop] = await db
      .update(shops)
      .set(updateData)
      .where(eq(shops.id, id))
      .returning();

    if (!updatedShop) {
      return NextResponse.json(
        { success: false, error: '更新店铺失败' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: updatedShop.id,
        shopName: updatedShop.name,
        platform: updatedShop.platform,
        isActive: updatedShop.is_active,
        ozonClientId: updatedShop.client_id,
        hasApiKey: !!updatedShop.api_key,
        createdAt: updatedShop.created_at,
        updatedAt: updatedShop.updated_at,
      },
      connectionTestNeeded, // 标记是否需要重新测试连接
      message: '店铺更新成功',
    });
  } catch (error) {
    console.error('[Shop Detail API] PUT error:', error);
    return NextResponse.json(
      { success: false, error: '更新店铺失败' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/shops/[id]
 * 软删除店铺（设置isActive=false）
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 检查店铺是否存在
    const [existingShop] = await db
      .select()
      .from(shops)
      .where(eq(shops.id, id))
      .limit(1);

    if (!existingShop) {
      return NextResponse.json(
        { success: false, error: '店铺不存在' },
        { status: 404 }
      );
    }

    // 软删除：设置is_active=false
    await db
      .update(shops)
      .set({
        is_active: false,
        updated_at: new Date(),
      })
      .where(eq(shops.id, id));

    return NextResponse.json({
      success: true,
      message: '店铺已删除',
    });
  } catch (error) {
    console.error('[Shop Detail API] DELETE error:', error);
    return NextResponse.json(
      { success: false, error: '删除店铺失败' },
      { status: 500 }
    );
  }
}
