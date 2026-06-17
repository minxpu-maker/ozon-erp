/**
 * 运费核对API
 * GET /api/finance/freight-reconciliation - 查询运费核对列表
 */
import { NextRequest, NextResponse } from 'next/server';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '@/storage/database/client';
import { shipmentRecords, orderFinance } from '@/storage/database/shared/fulfillment';
import { orders } from '@/storage/database/shared/schema';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const reconciled = searchParams.get('reconciled');
    const offset = parseInt(searchParams.get('offset') || '0');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);

    const conditions = [];
    if (reconciled === '0') {
      conditions.push(sql`${orderFinance.freightReconciled} = false OR ${orderFinance.freightReconciled} IS NULL`);
    } else if (reconciled === '1') {
      conditions.push(eq(orderFinance.freightReconciled, true));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const data = await db
      .select({
        order: {
          id: orders.id,
          ozonOrderId: orders.ozonOrderId,
          shopId: orders.shopId,
          createdAt: orders.createdAt,
        },
        finance: {
          id: orderFinance.id,
          orderId: orderFinance.orderId,
          freightReconciled: orderFinance.freightReconciled,
          reconciledAt: orderFinance.reconciledAt,
        },
        shipment: {
          shippingFee: shipmentRecords.shippingFee,
          packageWeight: shipmentRecords.packageWeight,
        }
      })
      .from(orders)
      .leftJoin(orderFinance, eq(orders.id, orderFinance.orderId))
      .leftJoin(shipmentRecords, eq(orders.id, shipmentRecords.orderId))
      .where(whereClause)
      .limit(limit)
      .offset(offset);

    const result = data.map(row => ({
      orderId: row.order.id,
      ozonOrderId: row.order.ozonOrderId,
      createdAt: row.order.createdAt,
      shippingFee: row.shipment?.shippingFee,
      packageWeight: row.shipment?.packageWeight,
      freightReconciled: row.finance?.freightReconciled,
      reconciledAt: row.finance?.reconciledAt,
    }));

    return NextResponse.json({ success: true, data: result, total: result.length });
  } catch (error) {
    console.error('[FreightReconciliation] GET error:', error);
    return NextResponse.json({ success: false, error: '查询失败' }, { status: 500 });
  }
}
