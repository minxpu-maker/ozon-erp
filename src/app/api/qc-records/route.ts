/**
 * 验货记录 API - 基于 orders 表
 * POST /api/qc-records - 录入验货记录并更新订单状态
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { orders, orderItems, purchaseTasks } from '@/storage/database/shared/schema';
import { qcRecords } from '@/storage/database/shared/fulfillment';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      orderId, 
      orderItemId,      // 可选：指定验货哪个商品
      purchaseTaskId,    // 可选：关联采购任务
      expressNo,         // 快递单号
      qcResult,          // pass/fail/partial
      quantityExpected,  // 预期数量
      quantityActual,    // 实际数量
      exceptionType,     // 异常类型
      remark,            // 备注
      operator          // 操作员
    } = body;

    // 必填校验
    if (!orderId) {
      return NextResponse.json({ success: false, error: 'orderId必填' }, { status: 400 });
    }
    if (!expressNo) {
      return NextResponse.json({ success: false, error: 'expressNo必填' }, { status: 400 });
    }
    if (!qcResult) {
      return NextResponse.json({ success: false, error: 'qcResult必填' }, { status: 400 });
    }
    if (!['pass', 'fail', 'partial'].includes(qcResult)) {
      return NextResponse.json({ success: false, error: 'qcResult必须为pass/fail/partial' }, { status: 400 });
    }

    // 验证订单存在
    const order = await db
      .select({ id: orders.id, status: orders.status, isInspected: orders.isInspected })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order || order.length === 0) {
      return NextResponse.json({ success: false, error: '订单不存在' }, { status: 404 });
    }

    // 构建 checkItems JSON
    const checkItems = {
      quantityExpected: quantityExpected || 0,
      quantityActual: quantityActual || 0,
      exceptionType: exceptionType || null,
      defectiveQty: quantityExpected && quantityActual ? Math.max(0, quantityExpected - quantityActual) : 0
    };

    // 插入验货记录
    const [newRecord] = await db
      .insert(qcRecords)
      .values({
        expressNo,
        ozonOrderId: null,
        qcResult,
        checkItems,
        quantityExpected,
        quantityActual,
        exceptionType,
        remark,
        operator,
        qcTime: new Date(),
      })
      .returning();

    // 更新订单验货状态
    await db
      .update(orders)
      .set({
        isInspected: true,
        inspectedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));

    // 如果有订单商品，更新验货数量
    if (orderItemId && quantityActual !== undefined) {
      await db
        .update(orderItems)
        .set({
          inspected_quantity: quantityActual,
          is_inspected: qcResult === 'pass',
          updated_at: new Date(),
        })
        .where(eq(orderItems.id, orderItemId));
    }

    // 如果有采购任务，更新状态
    if (purchaseTaskId) {
      await db
        .update(purchaseTasks)
        .set({
          status: qcResult === 'pass' ? 'inspected' : 'exception',
          updated_at: new Date(),
        })
        .where(eq(purchaseTasks.id, purchaseTaskId));
    }

    return NextResponse.json({
      success: true,
      data: newRecord,
      message: qcResult === 'pass' ? '验货通过' : '验货异常已记录'
    }, { status: 201 });

  } catch (error) {
    console.error('[QC Records] POST Error:', error);
    return NextResponse.json({ success: false, error: '创建验货记录失败' }, { status: 500 });
  }
}
