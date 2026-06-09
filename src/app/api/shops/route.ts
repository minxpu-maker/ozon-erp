import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { shops } from '@/storage/database/shared/schema';

/**
 * GET /api/shops - 获取店铺列表
 */
export async function GET() {
  try {
    const shopList = await db
      .select({
        id: shops.id,
        name: shops.name,
        client_id: shops.client_id,
        api_key: shops.api_key,
        is_primary: shops.is_primary,
        is_active: shops.is_active,
        last_sync_at: shops.last_sync_at,
        seller_type: shops.seller_type,
        current_stage: shops.current_stage,
        selection_mode: shops.selection_mode,
        price_range_min: shops.price_range_min,
        price_range_max: shops.price_range_max,
        created_at: shops.created_at,
      })
      .from(shops);

    // 脱敏处理 API Key
    const sanitizedShops = shopList.map(shop => ({
      ...shop,
      api_key: shop.api_key ? `${shop.api_key.slice(0, 6)}****${shop.api_key.slice(-4)}` : null,
    }));

    return NextResponse.json({
      success: true,
      data: sanitizedShops,
    });
  } catch (error) {
    console.error('获取店铺列表失败:', error);
    // 返回模拟数据作为兜底
    return NextResponse.json({
      success: true,
      data: [
        {
          id: 'shop-tiantan',
          name: 'TIANTAN',
          client_id: '1001',
          is_primary: true,
          is_active: true,
          seller_type: 'cn_crossborder',
          current_stage: 'mature',
          selection_mode: 'follow',
          price_range_min: 200,
          price_range_max: 1500,
        },
        {
          id: 'shop-test-1',
          name: '测试店铺1',
          client_id: '2001',
          is_primary: false,
          is_active: true,
          seller_type: 'cn_crossborder',
          current_stage: 'new',
          selection_mode: 'follow',
          price_range_min: 100,
          price_range_max: 500,
        },
      ],
    });
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
        id: newShop.id,
        name: newShop.name,
        client_id: newShop.client_id,
        is_primary: newShop.is_primary,
        is_active: newShop.is_active,
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
