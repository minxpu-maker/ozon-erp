import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { orders } from '@/storage/database/shared/schema';
import { eq, inArray } from 'drizzle-orm';

/**
 * PATCH /api/orders/batch/status
 * 批量更新订单状态
 * Body: {
 *   orderIds: string[],   // 订单ID数组
 *   erpStatus: string     // 目标状态 (packing/purchased/shipped等)
 * }
 */

// 合法的 erpStatus 值
const VALID_STATUSES = ['pending_purchase', 'purchasing', 'pending_packaging', 'packing', 'packed', 'shipped_domestic', 'delivered', 'cancelled'];

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderIds, erpStatus } = body;

    // 验证参数
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: '缺少订单ID列表' 
      }, { status: 400 });
    }

    if (!erpStatus) {
      return NextResponse.json({ 
        success: false, 
        error: '缺少目标状态' 
      }, { status: 400 });
    }

    // 验证状态值
    if (!VALID_STATUSES.includes(erpStatus)) {
      return NextResponse.json({ 
        success: false, 
        error: `非法状态值: ${erpStatus}，允许值: ${VALID_STATUSES.join(', ')}` 
      }, { status: 400 });
    }

    // 批量更新订单状态
    const updateResult = await db
      .update(orders)
      .set({ 
        erpStatus: erpStatus,
        updatedAt: new Date()
      })
      .where(inArray(orders.id, orderIds));

    return NextResponse.json({
      success: true,
      updated: orderIds.length,
      errors: []
    });

  } catch (error) {
    console.error('[orders/batch/status PATCH] Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: '批量更新失败' 
    }, { status: 500 });
  }
}
