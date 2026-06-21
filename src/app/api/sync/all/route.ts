/**
 * 全量同步 API
 * POST /api/sync/all - 同步所有数据（订单 + 产品）
 * GET /api/sync/all - 获取同步状态
 */

import { NextResponse } from 'next/server';
import { syncAllShops } from '@/lib/ozon-order-sync';
import { syncAllShopProducts } from '@/lib/ozon-product-sync';

/**
 * POST /api/sync/all
 * 全量同步所有数据（订单 + 产品）
 */
export async function POST() {
  const startTime = Date.now();
  
  try {
    console.log('[API] 开始全量同步...');
    
    // 1. 同步订单
    console.log('[Sync] 同步订单...');
    const orderResult = await syncAllShops();
    
    // 2. 同步产品
    console.log('[Sync] 同步产品...');
    const productResult = await syncAllShopProducts();
    
    const duration = Date.now() - startTime;
    
    return NextResponse.json({
      success: orderResult.success && productResult.success,
      message: `全量同步完成，耗时${(duration / 1000).toFixed(1)}秒`,
      data: {
        orders: {
          syncedShops: orderResult.syncedShops,
          failedShops: orderResult.failedShops,
          newOrders: orderResult.newOrders,
          updatedOrders: orderResult.updatedOrders,
          newDemands: orderResult.newDemands,
        },
        products: {
          syncedShops: productResult.syncedShops,
          failedShops: productResult.failedShops,
          totalProducts: productResult.totalProducts,
          newProducts: productResult.newProducts,
          updatedProducts: productResult.updatedProducts,
        },
        duration: `${(duration / 1000).toFixed(1)}秒`,
      },
    });
  } catch (error) {
    console.error('[API] 全量同步失败:', error);
    return NextResponse.json(
      {
        success: false,
        message: '全量同步失败',
        error: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/sync/all
 * 获取同步状态
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    message: '全量同步API正常',
    endpoints: {
      syncAll: 'POST /api/sync/all',
      syncOrders: 'POST /api/sync/orders',
      syncProducts: 'POST /api/sync/products',
      cronSync: 'GET /api/cron/sync-orders (定时任务)',
    },
  });
}
