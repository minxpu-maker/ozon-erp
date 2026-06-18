import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { orders } from '@/storage/database/shared/schema';
import { eq, and, desc, like, sql, count } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const shopId = searchParams.get('shopId');
    const status = searchParams.get('status');
    const orderId = searchParams.get('orderId');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');

    // Build where conditions
    const conditions = [];
    if (shopId && shopId !== 'all') {
      conditions.push(eq(orders.shopId, shopId));
    }
    if (status && status !== 'all') {
      conditions.push(eq(orders.erpStatus, status));
    }
    if (orderId) {
      conditions.push(like(orders.ozonPostingNumber, `%${orderId}%`));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Total count
    const [{ total }] = await db
      .select({ total: count() })
      .from(orders)
      .where(whereClause);

    // Orders with pagination
    const offset = (page - 1) * pageSize;
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
        shipmentDeadline: orders.shipmentDeadline,
        createdAt: orders.createdAt,
        lastSyncedAt: orders.lastSyncedAt,
      })
      .from(orders)
      .where(whereClause)
      .orderBy(desc(orders.createdAt))
      .limit(pageSize)
      .offset(offset);

    // Stats
    const [statsResult] = await db
      .select({
        total: count(),
        newCount: sql<number>`count(*) filter (where ${orders.erpStatus} = 'new')`,
        pendingCount: sql<number>`count(*) filter (where ${orders.erpStatus} = 'pending')`,
        shippingCount: sql<number>`count(*) filter (where ${orders.erpStatus} = 'in_transit' or ${orders.erpStatus} = 'verified')`,
        overdueCount: sql<number>`count(*) filter (where ${orders.shipmentDeadline} < now() and ${orders.erpStatus} not in ('shipped', 'delivered', 'cancelled'))`,
      })
      .from(orders);

    const stats = {
      newCount: Number(statsResult?.newCount ?? 0),
      pendingCount: Number(statsResult?.pendingCount ?? 0),
      shippingCount: Number(statsResult?.shippingCount ?? 0),
      overdueCount: Number(statsResult?.overdueCount ?? 0),
    };

    return NextResponse.json({
      success: true,
      orders: orderList,
      stats,
      total: Number(total),
      page,
      pageSize,
    });
  } catch (error) {
    console.error('[Orders] GET error:', error);
    return NextResponse.json({ success: false, error: '查询失败' }, { status: 500 });
  }
}
