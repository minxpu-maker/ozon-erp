import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { shops } from '@/storage/database/shared/schema';
import { eq } from 'drizzle-orm';
import { OzonApiClient } from '@/lib/ozon/client';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/shops/[id]/test - 测试店铺API连接
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // 获取店铺信息
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

    // 创建Ozon API客户端并测试连接
    const client = new OzonApiClient({
      clientId: shop.client_id,
      apiKey: shop.api_key,
    });

    // 测试获取订单列表（只取1条）
    let testResult;
    try {
      testResult = await client.getFbsOrders({
        limit: 1,
      });
    } catch (apiError) {
      return NextResponse.json({
        success: false,
        error: `API连接测试失败: ${apiError instanceof Error ? apiError.message : String(apiError)}`,
      });
    }

    if (!testResult || !testResult.result) {
      return NextResponse.json({
        success: false,
        error: 'API连接测试失败: 返回数据格式异常',
      });
    }

    return NextResponse.json({
      success: true,
      message: 'API连接测试成功',
      data: {
        shop_name: shop.name,
        client_id: shop.client_id,
        test_time: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('测试API连接失败:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '测试API连接失败',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
