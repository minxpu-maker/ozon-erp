/**
 * Ozon订单同步定时任务端点
 * 
 * Vercel Cron 定时触发：每5分钟一次
 * 
 * 配置 vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/sync-orders",
 *     "schedule": "every 5 minutes"
 *   }]
 * }
 * 
 * 安全：需要 Authorization: Bearer 验证
 */

import { NextRequest, NextResponse } from 'next/server';
import { syncAllShops } from '@/lib/ozon-order-sync';
import { syncAllShopProducts } from '@/lib/ozon-product-sync';

// CRON密钥（应设置为环境变量）
const CRON_SECRET = process.env.CRON_SECRET || 'development-cron-secret';

/**
 * 验证请求来源
 */
function validateCronRequest(request: NextRequest): boolean {
  // Vercel Cron 请求会自动带有 Authorization header
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader) {
    return false;
  }
  
  // 支持 Bearer token 格式
  const token = authHeader.replace(/^Bearer\s+/i, '');
  return token === CRON_SECRET;
}

export async function GET(request: NextRequest) {
  // 验证请求
  if (!validateCronRequest(request)) {
    console.warn('[CronOrderSync] 未授权的定时任务请求');
    return NextResponse.json({
      success: false,
      error: 'Unauthorized',
    }, { status: 401 });
  }

  const startTime = Date.now();
  
  try {
    console.log('[CronOrderSync] 定时同步开始');
    
    // 1. 同步订单
    console.log('[Cron] 同步订单...');
    const orderResult = await syncAllShops();
    
    // 2. 同步产品
    console.log('[Cron] 同步产品...');
    const productResult = await syncAllShopProducts();
    
    const duration = Date.now() - startTime;
    console.log(`[CronOrderSync] 定时同步完成，耗时${duration}ms`);
    
    return NextResponse.json({
      success: orderResult.success && productResult.success,
      message: `定时同步完成`,
      orders: {
        syncedShops: orderResult.syncedShops,
        failedShops: orderResult.failedShops,
        newOrders: orderResult.newOrders,
        updatedOrders: orderResult.updatedOrders,
      },
      products: {
        syncedShops: productResult.syncedShops,
        failedShops: productResult.failedShops,
        totalProducts: productResult.totalProducts,
      },
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '定时同步失败';
    console.error('[CronOrderSync] 定时同步失败:', errorMessage);
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

// 也支持POST请求（用于手动测试）
export async function POST(request: NextRequest) {
  return GET(request);
}
