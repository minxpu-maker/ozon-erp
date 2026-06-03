/**
 * 订单发货 API
 * POST /api/orders/ship - 订单打包发货
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOrderService } from '@/lib/ozon/order-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, shopId } = body;

    const service = getOrderService();

    // 打包订单
    if (action === 'ship') {
      const { postingNumber, products } = body;
      
      const result = await service.shipOrder(postingNumber, products, shopId);

      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        data: { packageNumber: result.packageNumber },
        message: '订单打包成功',
      });
    }

    // 设置物流单号并发货
    if (action === 'deliver') {
      const { postingNumber, trackingNumber } = body;
      
      const result = await service.deliverOrder(postingNumber, trackingNumber, shopId);

      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: '订单发货成功',
      });
    }

    // 获取面单
    if (action === 'getLabel') {
      const { postingNumbers } = body;
      
      const result = await service.getLabel(postingNumbers, shopId);

      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        data: { file: result.file },
        message: '获取面单成功',
      });
    }

    // 批量发货
    if (action === 'batchDeliver') {
      const { orders } = body as { orders: Array<{ postingNumber: string; trackingNumber: string }> };
      
      const results = await Promise.all(
        orders.map(async (order) => {
          const result = await service.deliverOrder(order.postingNumber, order.trackingNumber, shopId);
          return {
            postingNumber: order.postingNumber,
            success: result.success,
            error: result.error,
          };
        })
      );

      const successCount = results.filter((r) => r.success).length;

      return NextResponse.json({
        success: true,
        data: { results, successCount, failedCount: results.length - successCount },
        message: `批量发货完成: 成功 ${successCount} 条, 失败 ${results.length - successCount} 条`,
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Failed to ship order:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to ship order',
      },
      { status: 500 }
    );
  }
}
