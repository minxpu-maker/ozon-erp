import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { shops } from '@/storage/database/shared/schema';
import { eq } from 'drizzle-orm';
import { OzonApiClient, OzonApiError } from '@/lib/ozon/client';

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
    // Ozon API要求必须设置时间范围，所以使用最近30天
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    let testResult;
    try {
      testResult = await client.getFbsOrders({
        limit: 1,
        filter: {
          since: thirtyDaysAgo.toISOString(),
          to: now.toISOString(),
        },
      });
    } catch (apiError) {
      // 提取详细错误信息
      let errorDetail = '';
      if (apiError instanceof OzonApiError) {
        errorDetail = apiError.responseBody || '';
        try {
          const parsed = JSON.parse(errorDetail);
          if (parsed.error || parsed.message) {
            errorDetail = ` - ${parsed.error || parsed.message}`;
          }
        } catch {
          // 如果不是JSON，保持原始文本
          if (errorDetail) {
            errorDetail = ` - ${errorDetail.substring(0, 200)}`;
          }
        }
      }
      return NextResponse.json({
        success: false,
        error: `API连接测试失败: ${apiError instanceof Error ? apiError.message : String(apiError)}${errorDetail}`,
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
