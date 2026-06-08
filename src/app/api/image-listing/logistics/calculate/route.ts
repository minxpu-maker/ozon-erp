import { NextRequest, NextResponse } from 'next/server';

// POST /api/image-listing/logistics/calculate - 运费预览计算
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { logisticsTemplateId, weight, length, width, height, shopId } = body;

    if (!logisticsTemplateId || !weight || !shopId) {
      return NextResponse.json(
        { success: false, error: '缺少必填字段: logisticsTemplateId, weight, shopId' },
        { status: 400 }
      );
    }

    // TODO: 调用Ozon物流API计算运费
    // 目前返回模拟结果

    const weightKg = weight / 1000; // 转换为kg
    const volumeWeight = (length * width * height) / 5000000; // 体积重量

    // 取实际重量和体积重量的较大值
    const chargeableWeight = Math.max(weightKg, volumeWeight);

    // 模拟运费计算（实际应调用Ozon API）
    const baseRate = 150; // 基础运费 RUB/kg
    const shippingCost = Math.ceil(chargeableWeight * baseRate);

    const result = {
      logisticsTemplateId,
      weight: weightKg,
      volumeWeight,
      chargeableWeight,
      dimensions: { length, width, height },
      shippingCost,
      currency: 'RUB',
      estimatedDays: 14,
      provider: 'Ozon Rocket'
    };

    return NextResponse.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('[API] 运费计算失败:', error);
    return NextResponse.json(
      { success: false, error: '运费计算失败' },
      { status: 500 }
    );
  }
}
