/**
 * Ozon订单同步API (增强版)
 * 
 * POST /api/orders/sync - 触发同步，返回diff数据
 * 
 * 返回结构:
 * {
 *   success: boolean,
 *   message: string,
 *   data: {
 *     newOrders: number,      // 新增订单数
 *     updatedOrders: number,  // 状态变更数
 *     totalSynced: number,    // 总同步数
 *     shopCount: number,      // 成功店铺数
 *     shopErrors: number,     // 失败店铺数
 *     errorMessage: string    // 错误信息
 *   },
 *   syncedCount: number      // 兼容旧字段 = totalSynced
 * }
 */

import { NextResponse } from 'next/server';
import { syncAllShops } from '@/lib/ozon-order-sync';

// ============================================================================
// POST - 触发同步并返回diff数据
// ============================================================================

export async function POST() {
  try {
    console.log('[OrderSync] 收到同步请求 (增强版diff返回)');
    
    // 执行同步
    const result = await syncAllShops();
    
    // 构建增强版返回数据
    const response = {
      success: result.success,
      message: result.success 
        ? `同步完成 | ${result.syncedShops}个店铺成功`
        : `同步失败 | ${result.failedShops}个店铺失败`,
      data: {
        newOrders: result.newOrders,
        updatedOrders: result.updatedOrders,
        totalSynced: result.newOrders + result.updatedOrders,
        shopCount: result.syncedShops,
        shopErrors: result.failedShops,
        errorMessage: result.errors.length > 0 
          ? result.errors.map(e => `${e.shopName}: ${e.error}`).join('; ')
          : '',
      },
      // 兼容旧字段
      syncedCount: result.newOrders + result.updatedOrders,
    };
    
    console.log('[OrderSync] 同步结果:', JSON.stringify(response));
    
    // 返回207表示部分成功（某些店铺失败）
    return NextResponse.json(response, { 
      status: result.success ? 200 : (result.syncedShops > 0 ? 207 : 500) 
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '同步失败';
    console.error('[OrderSync] 同步失败:', errorMessage);
    
    return NextResponse.json({
      success: false,
      message: '同步失败',
      data: {
        newOrders: 0,
        updatedOrders: 0,
        totalSynced: 0,
        shopCount: 0,
        shopErrors: 1,
        errorMessage: errorMessage,
      },
      // 兼容旧字段
      syncedCount: 0,
    }, { status: 500 });
  }
}
