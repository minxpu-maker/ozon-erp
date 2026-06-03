/**
 * 订单列表 API
 * GET /api/orders - 获取订单列表
 * POST /api/orders - 同步订单
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOrderService } from '@/lib/ozon/order-service';
import type { OrderQueryParams, OzonPostingStatus } from '@/types/ozon';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    const params: OrderQueryParams = {
      page: parseInt(searchParams.get('page') || '1', 10),
      limit: parseInt(searchParams.get('limit') || '20', 10),
      status: searchParams.get('status') as OzonPostingStatus || undefined,
      search: searchParams.get('search') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      shopId: searchParams.get('shopId') || undefined,
      sortBy: searchParams.get('sortBy') || undefined,
      sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || undefined,
    };

    const service = getOrderService();
    const result = await service.getOrders(params);

    return NextResponse.json({
      success: true,
      data: result.orders,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
      },
    });
  } catch (error) {
    console.error('Failed to get orders:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get orders',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, shopId, since, to, status } = body;

    if (action === 'sync') {
      const service = getOrderService();
      const result = await service.syncOrders({
        shopId,
        since,
        to,
        status,
      });

      return NextResponse.json({
        success: true,
        data: result,
        message: `同步完成: 新增 ${result.new} 条, 更新 ${result.updated} 条, 失败 ${result.failed} 条`,
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Failed to process order action:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process action',
      },
      { status: 500 }
    );
  }
}
