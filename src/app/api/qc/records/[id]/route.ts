import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { qcRecords } from '@/storage/database/shared/fulfillment';
import { orders } from '@/storage/database/shared/schema';
import { eq } from 'drizzle-orm';

/**
 * GET /api/qc/records/[id] - 获取验货记录详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const recordId = parseInt(id);

    if (isNaN(recordId)) {
      return NextResponse.json(
        { success: false, error: '无效的ID' },
        { status: 400 }
      );
    }

    // 查询验货记录
    const record = await db
      .select({
        id: qcRecords.id,
        purchaseId: qcRecords.purchaseId,
        expressNo: qcRecords.expressNo,
        ozonOrderId: qcRecords.ozonOrderId,
        qcResult: qcRecords.qcResult,
        checkItems: qcRecords.checkItems,
        quantityExpected: qcRecords.quantityExpected,
        quantityActual: qcRecords.quantityActual,
        exceptionType: qcRecords.exceptionType,
        remark: qcRecords.remark,
        operator: qcRecords.operator,
        qcTime: qcRecords.qcTime,
        createdAt: qcRecords.createdAt,
      })
      .from(qcRecords)
      .where(eq(qcRecords.id, recordId))
      .limit(1);

    if (!record || record.length === 0) {
      return NextResponse.json(
        { success: false, error: '验货记录不存在' },
        { status: 404 }
      );
    }

    // 查询关联的订单信息
    let orderInfo = null;
    if (record[0].ozonOrderId) {
      const order = await db
        .select({
          id: orders.id,
          ozon_order_id: orders.ozonOrderId,
          status: orders.status,
        })
        .from(orders)
        .where(eq(orders.ozonOrderId, record[0].ozonOrderId))
        .limit(1);
      
      if (order.length > 0) {
        orderInfo = order[0];
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        ...record[0],
        orderInfo,
      },
    });
  } catch (error) {
    console.error('[QC Record] GET Error:', error);
    return NextResponse.json(
      { success: false, error: '查询失败' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/qc/records/[id] - 更新验货记录
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const recordId = parseInt(id);

    if (isNaN(recordId)) {
      return NextResponse.json(
        { success: false, error: '无效的ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { qcResult, exceptionType, remark, operator } = body;

    // 验证qcResult
    if (qcResult && !['pass', 'fail', 'partial'].includes(qcResult)) {
      return NextResponse.json(
        { success: false, error: 'qcResult 必须为 pass/fail/partial' },
        { status: 400 }
      );
    }

    // 验证exceptionType
    if (exceptionType && !['wrong_item', 'wrong_qty', 'quality', 'wrong_spec', 'damaged'].includes(exceptionType)) {
      return NextResponse.json(
        { success: false, error: 'exceptionType 无效' },
        { status: 400 }
      );
    }

    // 查询现有记录
    const existingRecord = await db
      .select({
        id: qcRecords.id,
        ozonOrderId: qcRecords.ozonOrderId,
        qcResult: qcRecords.qcResult,
      })
      .from(qcRecords)
      .where(eq(qcRecords.id, recordId))
      .limit(1);

    if (!existingRecord || existingRecord.length === 0) {
      return NextResponse.json(
        { success: false, error: '验货记录不存在' },
        { status: 404 }
      );
    }

    // 构建更新数据
    const updateData: Record<string, unknown> = {};
    if (qcResult !== undefined) updateData.qcResult = qcResult;
    if (exceptionType !== undefined) updateData.exceptionType = exceptionType;
    if (remark !== undefined) updateData.remark = remark;
    if (operator !== undefined) updateData.operator = operator;

    // 更新验货记录
    const [updatedRecord] = await db
      .update(qcRecords)
      .set(updateData)
      .where(eq(qcRecords.id, recordId))
      .returning();

    // 如果qcResult变更，同步更新订单验货状态
    if (qcResult !== undefined && qcResult !== existingRecord[0].qcResult && existingRecord[0].ozonOrderId) {
      await db
        .update(orders)
        .set({
          isInspected: qcResult === 'pass',
          inspectedAt: qcResult === 'pass' ? new Date() : null,
        })
        .where(eq(orders.ozonOrderId, existingRecord[0].ozonOrderId));
    }

    return NextResponse.json({
      success: true,
      data: updatedRecord,
      message: '验货记录更新成功',
    });
  } catch (error) {
    console.error('[QC Record] PATCH Error:', error);
    return NextResponse.json(
      { success: false, error: '更新失败' },
      { status: 500 }
    );
  }
}
