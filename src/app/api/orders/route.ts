import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { qcRecords } from '@/storage/database/shared/fulfillment';
import { orders } from '@/storage/database/shared/schema';
import { eq, and, desc } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');

    let whereClause;

    if (orderId) {
      whereClause = eq(orders.id, orderId);
    } else if (status) {
      whereClause = eq(orders.status, status);
    }

    const orderList = await db
      .select({
        id: orders.id,
        ozonOrderId: orders.ozonOrderId,
        ozonPostingNumber: orders.ozonPostingNumber,
        shopId: orders.shopId,
        status: orders.status,
        erpStatus: orders.erpStatus,
        buyerName: orders.buyerName,
        recipientName: orders.recipientName,
        recipientCity: orders.recipientCity,
        totalPrice: orders.totalPrice,
        isPurchaseBound: orders.isPurchaseBound,
        isInspected: orders.isInspected,
        isPacked: orders.isPacked,
        shippedAt: orders.shippedAt,
        createdAt: orders.createdAt,
        lastSyncedAt: orders.lastSyncedAt,
      })
      .from(orders)
      .where(whereClause)
      .orderBy(desc(orders.createdAt))
      .limit(limit);

    return NextResponse.json({ success: true, data: orderList });
  } catch (error) {
    console.error('[Orders] GET error:', error);
    return NextResponse.json({ success: false, error: '查询失败' }, { status: 500 });
  }
}
