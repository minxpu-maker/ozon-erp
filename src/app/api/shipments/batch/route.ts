import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { shipmentRecords, qcRecords } from '@/storage/database/shared/fulfillment';
import { orders, shops } from '@/storage/database/shared/schema';
import { eq, inArray } from 'drizzle-orm';

interface BatchRequest {
  action: 'print-labels' | 'confirm-ship';
  orderIds: string[];
}

export async function POST(request: NextRequest) {
  try {
    const body: BatchRequest = await request.json();

    if (!body.action || !['print-labels', 'confirm-ship'].includes(body.action)) {
      return NextResponse.json(
        { success: false, error: 'action必须是print-labels或confirm-ship' },
        { status: 400 }
      );
    }

    if (!Array.isArray(body.orderIds) || body.orderIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'orderIds不能为空' },
        { status: 400 }
      );
    }

    // 查询订单
    const ordersResult = await db
      .select({ order: orders, shop: shops })
      .from(orders)
      .leftJoin(shops, eq(orders.shopId, shops.id))
      .where(inArray(orders.id, body.orderIds));

    if (ordersResult.length === 0) {
      return NextResponse.json(
        { success: false, error: '未找到订单' },
        { status: 404 }
      );
    }

    // 查询验货记录（按 ozonOrderId 查询）
    const ozonOrderIds = ordersResult.map(o => o.order.ozonOrderId).filter(Boolean);
    const qcList = ozonOrderIds.length > 0 
      ? await db.select().from(qcRecords).where(inArray(qcRecords.ozonOrderId, ozonOrderIds))
      : [];
    const qcMap = new Map(qcList.map((q) => [q.ozonOrderId!, q]));

    // 查询发货记录
    const shipmentList = await db
      .select()
      .from(shipmentRecords)
      .where(inArray(shipmentRecords.orderId, body.orderIds));
    const shipmentMap = new Map(shipmentList.map((s) => [s.orderId, s]));

    if (body.action === 'print-labels') {
      return handleBatchPrintLabels(ordersResult, qcMap, shipmentMap);
    } else {
      return handleBatchConfirmShip(ordersResult, shipmentMap);
    }
  } catch (error) {
    console.error('[Shipments] Batch error:', error);
    return NextResponse.json(
      { success: false, error: '批量操作失败' },
      { status: 500 }
    );
  }
}

async function handleBatchPrintLabels(
  ordersResult: Array<{ order: typeof orders.$inferSelect; shop: typeof shops.$inferSelect | null }>,
  qcMap: Map<string, typeof qcRecords.$inferSelect>,
  shipmentMap: Map<string, typeof shipmentRecords.$inferSelect>
) {
  const results: Array<{ orderId: string; success: boolean; error?: string }> = [];

  for (const item of ordersResult) {
    const orderId = item.order.id;

    // 验证验货状态
    const qc = qcMap.get(item.order.ozonOrderId);
    if (!qc || qc.qcResult !== 'pass') {
      results.push({ orderId, success: false, error: '必须验货通过后才能获取面单' });
      continue;
    }

    // 验证称重记录
    const shipment = shipmentMap.get(orderId);
    if (!shipment) {
      results.push({ orderId, success: false, error: '请先完成称重' });
      continue;
    }

    results.push({ orderId, success: true });
  }

  const successCount = results.filter((r) => r.success).length;
  return NextResponse.json({
    success: true,
    data: { results, summary: { total: results.length, success: successCount, failed: results.length - successCount } },
  });
}

async function handleBatchConfirmShip(
  ordersResult: Array<{ order: typeof orders.$inferSelect; shop: typeof shops.$inferSelect | null }>,
  shipmentMap: Map<string, typeof shipmentRecords.$inferSelect>
) {
  const results: Array<{ orderId: string; success: boolean; error?: string }> = [];

  for (const item of ordersResult) {
    const orderId = item.order.id;

    // 验证发货记录
    const shipment = shipmentMap.get(orderId);
    if (!shipment) {
      results.push({ orderId, success: false, error: '请先完成称重' });
      continue;
    }

    results.push({ orderId, success: true });
  }

  const successCount = results.filter((r) => r.success).length;
  return NextResponse.json({
    success: true,
    data: { results, summary: { total: results.length, success: successCount, failed: results.length - successCount } },
  });
}
