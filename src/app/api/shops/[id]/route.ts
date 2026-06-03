import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { shops } from '@/storage/database/shared/schema';
import { eq } from 'drizzle-orm';
import { OzonApiClient } from '@/lib/ozon/client';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/shops/[id] - 获取店铺详情
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

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
        ...shop,
        api_key: `${shop.api_key.substring(0, 8)}****${shop.api_key.substring(shop.api_key.length - 4)}`,
      },
    });
  } catch (error) {
    console.error('获取店铺详情失败:', error);
    return NextResponse.json(
      { success: false, error: '获取店铺详情失败' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/shops/[id] - 更新店铺信息
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, client_id, api_key, is_primary, is_active } = body;

    // 检查店铺是否存在
    const [existing] = await db
      .select()
      .from(shops)
      .where(eq(shops.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { success: false, error: '店铺不存在' },
        { status: 404 }
      );
    }

    // 如果设为主店铺，先取消其他店铺的主店铺标记
    if (is_primary) {
      const allShops = await db.select().from(shops);
      for (const shop of allShops.filter(s => s.is_primary && s.id !== id)) {
        await db
          .update(shops)
          .set({ is_primary: false })
          .where(eq(shops.id, shop.id));
      }
    }

    // 更新店铺
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (client_id !== undefined) updateData.client_id = client_id;
    if (api_key !== undefined) updateData.api_key = api_key;
    if (is_primary !== undefined) updateData.is_primary = is_primary;
    if (is_active !== undefined) updateData.is_active = is_active;

    const [updated] = await db
      .update(shops)
      .set(updateData)
      .where(eq(shops.id, id))
      .returning();

    return NextResponse.json({
      success: true,
      data: {
        ...updated,
        api_key: `${updated.api_key.substring(0, 8)}****${updated.api_key.substring(updated.api_key.length - 4)}`,
      },
      message: '店铺更新成功',
    });
  } catch (error) {
    console.error('更新店铺失败:', error);
    return NextResponse.json(
      { success: false, error: '更新店铺失败' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/shops/[id] - 删除店铺
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // 检查店铺是否存在
    const [existing] = await db
      .select()
      .from(shops)
      .where(eq(shops.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { success: false, error: '店铺不存在' },
        { status: 404 }
      );
    }

    // 删除店铺
    await db.delete(shops).where(eq(shops.id, id));

    return NextResponse.json({
      success: true,
      message: '店铺删除成功',
    });
  } catch (error) {
    console.error('删除店铺失败:', error);
    return NextResponse.json(
      { success: false, error: '删除店铺失败' },
      { status: 500 }
    );
  }
}
