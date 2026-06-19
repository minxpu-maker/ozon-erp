/**
 * 店铺管理 API - 列表和创建
 * GET /api/shops - 获取店铺列表
 * POST /api/shops - 创建新店铺
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { shops } from '@/storage/database/shared/schema';
import { eq, desc } from 'drizzle-orm';
import { encrypt } from '@/lib/crypto';

// 店铺列表返回类型（不暴露API密钥）
interface ShopListItem {
  id: string;
  shopName: string;
  platform: string;
  isActive: boolean;
  ozonClientId: string | null;
  hasApiKey: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
}

// 创建店铺请求类型
interface CreateShopBody {
  shopName: string;
  ozonClientId: string;
  ozonApiKey: string;
  platform?: string;
}

/**
 * GET /api/shops
 * 获取店铺列表（默认只返回激活的店铺）
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const includeInactive = searchParams.get('includeInactive') === 'true';

    // 构建查询条件 - 使用snake_case字段
    const queryCondition = includeInactive ? undefined : eq(shops.isActive, true);

    // 查询店铺列表
    const shopList = await db
      .select()
      .from(shops)
      .where(queryCondition)
      .orderBy(desc(shops.createdAt));

    // 格式化返回数据，隐藏API密钥 - 使用主字段 client_id/api_key 或兼容字段 ozon_client_id/ozon_api_key
    const result: ShopListItem[] = shopList.map(shop => ({
      id: shop.id,
      shopName: shop.name || '',
      platform: shop.platform || 'ozon',
      isActive: shop.isActive ?? true,
      ozonClientId: shop.clientId || shop.ozonClientId || null,
      hasApiKey: !!(shop.apiKey || shop.ozonApiKey),
      createdAt: shop.createdAt,
      updatedAt: shop.updatedAt,
    }));

    return NextResponse.json({
      success: true,
      shops: result,
      total: result.length,
    });
  } catch (error) {
    console.error('[Shops API] GET error:', error);
    return NextResponse.json(
      { success: false, error: '获取店铺列表失败' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/shops
 * 创建新店铺
 */
export async function POST(request: NextRequest) {
  try {
    const body: CreateShopBody = await request.json();

    // 必填校验
    if (!body.shopName?.trim()) {
      return NextResponse.json(
        { success: false, error: '店铺名称不能为空' },
        { status: 400 }
      );
    }

    if (!body.ozonClientId?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Ozon Client-ID 不能为空' },
        { status: 400 }
      );
    }

    if (!body.ozonApiKey?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Ozon API-Key 不能为空' },
        { status: 400 }
      );
    }

    // 检查店铺名称是否已存在
    const existing = await db
      .select({ id: shops.id })
      .from(shops)
      .where(eq(shops.name, body.shopName.trim()))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { success: false, error: '店铺名称已存在' },
        { status: 409 }
      );
    }

    // 加密API密钥
    const encryptedApiKey = encrypt(body.ozonApiKey.trim());

    // 创建店铺 - 使用主字段 client_id/api_key（必填）
    const now = new Date();
    const newShop = {
      name: body.shopName.trim(),
      clientId: body.ozonClientId.trim(),
      apiKey: encryptedApiKey,
      platform: body.platform || 'ozon',
      isActive: true,
      isPrimary: false,
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.insert(shops).values(newShop).returning();

    if (!result || result.length === 0) {
      return NextResponse.json(
        { success: false, error: '创建店铺失败' },
        { status: 500 }
      );
    }

    const created = result[0];

    // 返回创建的店铺（不包含API密钥明文）
    return NextResponse.json({
      success: true,
      data: {
        id: created.id,
        shopName: created.name,
        platform: created.platform,
        isActive: created.isActive,
        ozonClientId: created.clientId,
        hasApiKey: true,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
      },
      message: '店铺创建成功',
    }, { status: 201 });
  } catch (error) {
    console.error('[Shops API] POST error:', error);
    return NextResponse.json(
      { success: false, error: '创建店铺失败' },
      { status: 500 }
    );
  }
}
