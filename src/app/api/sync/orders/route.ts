/**
 * Ozon订单同步API
 * 
 * POST /api/sync/orders - 手动触发同步
 * GET /api/sync/orders - 获取同步状态
 */

import { NextRequest, NextResponse } from 'next/server';
import { syncAllShops, getShopSyncStatuses } from '@/lib/ozon-order-sync';

// ============================================================================
// POST - 手动触发同步
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    console.log('[OrderSync] 收到手动同步请求');
    
    // 执行同步
    const result = await syncAllShops();
    
    return NextResponse.json({
      success: result.success,
      message: result.success 
        ? `同步完成: ${result.syncedShops}个店铺, 新订单${result.newOrders}, 更新${result.updatedOrders}, 新需求${result.newDemands}`
        : `同步完成但有${result.failedShops}个店铺失败`,
      syncedShops: result.syncedShops,
      failedShops: result.failedShops,
      newOrders: result.newOrders,
      updatedOrders: result.updatedOrders,
      newDemands: result.newDemands,
      errors: result.errors,
    }, { status: result.success ? 200 : 207 }); // 207 = Multi-Status
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '同步失败';
    console.error('[OrderSync] 同步失败:', errorMessage);
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
    }, { status: 500 });
  }
}

// ============================================================================
// GET - 获取同步状态
// ============================================================================

export async function GET() {
  try {
    const statuses = await getShopSyncStatuses();
    
    return NextResponse.json({
      success: true,
      data: statuses,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '获取状态失败';
    console.error('[OrderSync] 获取状态失败:', errorMessage);
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
    }, { status: 500 });
  }
}
