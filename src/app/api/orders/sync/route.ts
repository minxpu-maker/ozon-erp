/**
 * 订单同步 API
 * POST /api/orders/sync - 同步Ozon订单
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOrderService } from '@/lib/ozon/order-service';
import type { OzonPostingStatus } from '@/types/ozon';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      shopId, 
      since, 
      to, 
      status = 'awaiting_packaging' as OzonPostingStatus,
      fullSync = false 
    } = body;

    const service = getOrderService();

    // 全量同步 or 增量同步
    let syncSince = since;
    let syncTo = to || new Date().toISOString();

    if (!fullSync && !since) {
      // 增量同步：默认同步最近24小时
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      syncSince = yesterday.toISOString();
    }

    const result = await service.syncOrders({
      shopId,
      since: syncSince,
      to: syncTo,
      status,
    });

    return NextResponse.json({
      success: true,
      data: {
        total: result.total,
        new: result.new,
        updated: result.updated,
        failed: result.failed,
        errors: result.errors,
      },
      message: `同步完成: 共 ${result.total} 条订单, 新增 ${result.new} 条, 更新 ${result.updated} 条, 失败 ${result.failed} 条`,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Order sync failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Order sync failed',
      },
      { status: 500 }
    );
  }
}

/**
 * 获取同步状态
 * GET /api/orders/sync - 获取最近同步状态
 */
export async function GET() {
  try {
    // TODO: 从数据库获取最近同步记录
    // 暂时返回模拟数据
    return NextResponse.json({
      success: true,
      data: {
        lastSyncAt: null,
        status: 'idle',
        message: '暂无同步记录',
      },
    });
  } catch (error) {
    console.error('Failed to get sync status:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get sync status',
      },
      { status: 500 }
    );
  }
}
