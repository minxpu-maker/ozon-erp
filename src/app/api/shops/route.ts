import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { shops } from '@/storage/database/shared/schema';
import { desc, eq, and } from 'drizzle-orm';

/**
 * GET /api/shops - 获取店铺列表
 */
export async function GET() {
  try {
    const shopList = await db
      .select()
      .from(shops)
      .orderBy(desc(shops.created_at));

    // 脱敏处理API Key
    const maskedShops = shopList.map(shop => ({
      ...shop,
      api_key: shop.api_key ? `${shop.api_key.substring(0, 8)}****${shop.api_key.substring(shop.api_key.length - 4)}` : '',
    }));

    return NextResponse.json({
      success: true,
      data: maskedShops,
    });
  } catch (error) {
    console.error('获取店铺列表失败:', error);
    return NextResponse.json(
      { success: false, error: '获取店铺列表失败' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/shops - 添加新店铺
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, client_id, api_key, is_primary } = body;

    // 验证必填字段
    if (!name || !client_id || !api_key) {
      return NextResponse.json(
        { success: false, error: '店铺名称、Client ID和API Key为必填项' },
        { status: 400 }
      );
    }

    // 检查是否已存在相同Client ID的店铺
    const existing = await db.select().from(shops);

    const duplicateClient = existing.find(s => s.client_id === client_id);
    if (duplicateClient) {
      return NextResponse.json(
        { success: false, error: '该Client ID已被使用' },
        { status: 400 }
      );
    }

    // 如果设为主店铺，先取消其他店铺的主店铺标记
    if (is_primary) {
      const primaryShops = existing.filter(s => s.is_primary);
      for (const shop of primaryShops) {
        await db
          .update(shops)
          .set({ is_primary: false })
          .where(eq(shops.id, shop.id));
      }
    }

    // 插入新店铺
    const [newShop] = await db
      .insert(shops)
      .values({
        name,
        client_id,
        api_key,
        is_primary: is_primary || false,
        is_active: true,
      })
      .returning();

    return NextResponse.json({
      success: true,
      data: {
        ...newShop,
        api_key: `${api_key.substring(0, 8)}****${api_key.substring(api_key.length - 4)}`,
      },
      message: '店铺添加成功',
    });
  } catch (error) {
    console.error('添加店铺失败:', error);
    return NextResponse.json(
      { success: false, error: '添加店铺失败' },
      { status: 500 }
    );
  }
}
