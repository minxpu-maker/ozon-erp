import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { shops } from '@/storage/database/shared/schema';
import { eq } from 'drizzle-orm';
import { OzonApiClient, OzonApiError } from '@/lib/ozon/client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { postingNumbers, shopId } = body as { 
      postingNumbers: string[]; 
      shopId: string;
    };

    if (!postingNumbers || !Array.isArray(postingNumbers) || postingNumbers.length === 0) {
      return NextResponse.json(
        { success: false, error: '请提供订单发货单号' },
        { status: 400 }
      );
    }

    if (!shopId) {
      return NextResponse.json(
        { success: false, error: '请提供店铺ID' },
        { status: 400 }
      );
    }

    // 获取店铺信息
    const shopList = await db.select().from(shops).where(eq(shops.id, shopId));
    if (shopList.length === 0) {
      return NextResponse.json(
        { success: false, error: '店铺不存在' },
        { status: 404 }
      );
    }

    const shop = shopList[0];
    
    // 验证店铺API配置
    if (!shop.api_key || !shop.client_id) {
      return NextResponse.json(
        { success: false, error: '店铺API未配置' },
        { status: 400 }
      );
    }

    // 创建Ozon API客户端
    const ozonClient = new OzonApiClient({ 
      clientId: shop.client_id, 
      apiKey: shop.api_key 
    });

    // 获取面单
    const result = await ozonClient.getPackageLabel(postingNumbers);

    return NextResponse.json({
      success: true,
      data: {
        fileUrl: result.fileUrl,
        printedCount: result.printedCount,
        unprintedCount: result.unprintedCount,
        postingNumbers,
      },
    });
  } catch (error) {
    console.error('获取面单失败:', error);
    
    if (error instanceof OzonApiError) {
      return NextResponse.json(
        { success: false, error: `Ozon API错误: ${error.message}` },
        { status: error.statusCode || 500 }
      );
    }

    return NextResponse.json(
      { success: false, error: '获取面单失败' },
      { status: 500 }
    );
  }
}
