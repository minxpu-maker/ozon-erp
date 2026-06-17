import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/storage/database/client';
import { eq, and, gte, lte, sql, desc } from 'drizzle-orm';

const { qcRecords, purchaseRecords, ozonOrders, purchaseDemands, shops } = schema;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // 日期筛选（默认今天）
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const dateParam = searchParams.get('date');
    const qcResult = searchParams.get('qcResult');
    const operator = searchParams.get('operator');
    
    let dateCondition;
    if (dateParam) {
      const date = new Date(dateParam);
      const dateStart = new Date(date);
      dateStart.setHours(0, 0, 0, 0);
      const dateEnd = new Date(date);
      dateEnd.setHours(23, 59, 59, 999);
      dateCondition = and(
        gte(qcRecords.qcTime, dateStart),
        lte(qcRecords.qcTime, dateEnd)
      );
    } else {
      dateCondition = and(
        gte(qcRecords.qcTime, today),
        lte(qcRecords.qcTime, tomorrow)
      );
    }

    // 分页参数
    const offset = parseInt(searchParams.get('offset') || '0');
    const limit = parseInt(searchParams.get('limit') || '50');

    // 构建查询条件
    const conditions = [dateCondition];
    if (qcResult) {
      conditions.push(eq(qcRecords.qcResult, qcResult));
    }
    if (operator) {
      conditions.push(eq(qcRecords.operator, operator));
    }

    // 查询验货记录
    const records = await db
      .select({
        // qc_records 字段
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
        // purchase_records 字段
        purchaseStatus: purchaseRecords.status,
        supplierName: purchaseRecords.supplierName,
        supplierSource: purchaseRecords.supplierSource,
        purchasePrice: purchaseRecords.purchasePrice,
        purchaseQty: purchaseRecords.purchaseQty,
        domesticTrackingNo: purchaseRecords.domesticTrackingNo,
        // ozon_orders 字段
        ozonOrderIdValue: ozonOrders.ozonOrderId,
        ozonPostingNumber: ozonOrders.ozonPostingNumber,
        customerName: ozonOrders.customerName,
        orderAmount: ozonOrders.orderAmount,
        // purchase_demands 字段
        sku: purchaseDemands.sku,
        productName: purchaseDemands.productName,
        productImage: purchaseDemands.productImage,
      })
      .from(qcRecords)
      .leftJoin(
        purchaseRecords,
        eq(purchaseRecords.id, qcRecords.purchaseId)
      )
      .leftJoin(
        purchaseDemands,
        eq(purchaseDemands.id, purchaseRecords.demandId)
      )
      .leftJoin(
        ozonOrders,
        eq(ozonOrders.id, purchaseDemands.orderId)
      )
      .where(and(...conditions.filter(Boolean)))
      .orderBy(desc(qcRecords.qcTime))
      .limit(limit)
      .offset(offset);

    // 统计总数
    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(qcRecords)
      .where(and(...conditions.filter(Boolean)));

    return NextResponse.json({
      success: true,
      data: records,
      total: countResult[0]?.count || 0,
      offset,
      limit,
    });
  } catch (error) {
    console.error('[QC Records] GET Error:', error);
    return NextResponse.json(
      { success: false, error: '查询失败' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { purchaseId, expressNo, qcResult, quantityExpected, quantityActual, exceptionType, remark, operator } = body;

    // 必填校验
    if (!purchaseId || !expressNo || !qcResult) {
      return NextResponse.json(
        { success: false, error: '缺少必填字段：purchaseId, expressNo, qcResult' },
        { status: 400 }
      );
    }

    // 验证qcResult
    if (!['pass', 'fail', 'partial'].includes(qcResult)) {
      return NextResponse.json(
        { success: false, error: 'qcResult 必须为 pass/fail/partial' },
        { status: 400 }
      );
    }

    // 查询关联的采购记录和订单信息
    const purchaseRecord = await db
      .select({
        id: purchaseRecords.id,
        demandId: purchaseRecords.demandId,
        status: purchaseRecords.status,
      })
      .from(purchaseRecords)
      .where(eq(purchaseRecords.id, purchaseId))
      .limit(1);

    if (!purchaseRecord || purchaseRecord.length === 0) {
      return NextResponse.json(
        { success: false, error: '采购记录不存在' },
        { status: 404 }
      );
    }

    // 查询关联的订单ID
    const demand = await db
      .select({ orderId: purchaseDemands.orderId })
      .from(purchaseDemands)
      .where(eq(purchaseDemands.id, purchaseRecord[0].demandId))
      .limit(1);

    const ozonOrderId = demand?.[0]?.orderId || null;

    // 插入验货记录
    const [newRecord] = await db
      .insert(qcRecords)
      .values({
        purchaseId,
        expressNo,
        ozonOrderId,
        qcResult,
        quantityExpected,
        quantityActual,
        exceptionType,
        remark,
        operator,
        qcTime: new Date(),
      })
      .returning();

    // 根据验货结果更新采购记录状态
    if (qcResult === 'pass') {
      await db
        .update(purchaseRecords)
        .set({
          status: 'verified',
          verifiedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(purchaseRecords.id, purchaseId));
    } else {
      // fail 或 partial 都标记为异常
      await db
        .update(purchaseRecords)
        .set({
          status: 'exception',
          exceptionType: exceptionType || qcResult,
          updatedAt: new Date(),
        })
        .where(eq(purchaseRecords.id, purchaseId));
    }

    return NextResponse.json({
      success: true,
      data: newRecord,
      message: '验货记录创建成功',
    });
  } catch (error) {
    console.error('[QC Records] POST Error:', error);
    return NextResponse.json(
      { success: false, error: '创建验货记录失败' },
      { status: 500 }
    );
  }
}
