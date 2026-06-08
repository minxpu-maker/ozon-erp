import { NextRequest, NextResponse } from 'next/server';
import { getTariffList } from '@/lib/ozon';

// GET /api/image-listing/logistics/templates - 获取物流模板列表
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const shopId = searchParams.get('shopId');

    if (!shopId) {
      return NextResponse.json(
        { success: false, error: '缺少必填参数: shopId' },
        { status: 400 }
      );
    }

    // 调用Ozon API获取物流模板
    const tariffs = await getTariffList(shopId);

    return NextResponse.json({
      success: true,
      data: tariffs
    });
  } catch (error) {
    console.error('[API] 获取物流模板失败:', error);
    return NextResponse.json(
      { success: false, error: '获取物流模板失败' },
      { status: 500 }
    );
  }
}
