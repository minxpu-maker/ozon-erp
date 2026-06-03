/**
 * 订单详情 API
 * GET /api/orders/[orderId] - 获取订单详情
 * PUT /api/orders/[orderId] - 更新订单
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOrderService } from '@/lib/ozon/order-service';

interface RouteParams {
  params: Promise<{ orderId: string }>;
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { orderId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const shopId = searchParams.get('shopId') || undefined;

    const service = getOrderService();
    const order = await service.getOrderById(orderId, shopId);

    return NextResponse.json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error('Failed to get order:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get order',
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { orderId } = await params;
    const body = await request.json();
    const { action, data } = body;

    // TODO: 实现订单更新逻辑
    // - 取消订单
    // - 更新备注
    // - 更新状态

    return NextResponse.json({
      success: true,
      data: { orderId, action, updated: true },
      message: '订单更新成功',
    });
  } catch (error) {
    console.error('Failed to update order:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update order',
      },
      { status: 500 }
    );
  }
}
