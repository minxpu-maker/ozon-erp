import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { orders } from '@/storage/database/shared/schema';
import { webhookLogs } from '@/db/schema/fulfillment';
import { eq, and, desc, like, sql, count, inArray } from 'drizzle-orm';

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
    const orderListRaw: Record<string, unknown>[] = await db
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

    // Per-order unread message count
    const orderIds = orderListRaw.map((o: Record<string, unknown>) => o.id as string);
    const validOrderIds = orderIds.filter(Boolean);
    const unreadCounts = validOrderIds.length > 0
      ? await db
          .select({ orderId: webhookLogs.orderId, count: count() })
          .from(webhookLogs)
          .where(and(
            inArray(webhookLogs.orderId, validOrderIds),
            eq(webhookLogs.eventType, 'TYPE_NEW_MESSAGE'),
            eq(webhookLogs.isRead, false)
          ))
          .groupBy(webhookLogs.orderId)
      : [];
    const unreadMap = new Map<string, number>(unreadCounts.map(u => [u.orderId ?? '', Number(u.count)]));
    const orderList = orderListRaw.map((o: Record<string, unknown>) => ({
      ...o,
      unreadMessageCount: unreadMap.get(o.id as string) ?? 0,
    }));

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

    // Unread message count (all orders, regardless of filters)
    const [unreadMsgCountResult] = await db
      .select({ count: count() })
      .from(webhookLogs)
      .where(and(
        eq(webhookLogs.eventType, 'TYPE_NEW_MESSAGE'),
        eq(webhookLogs.isRead, false)
      ));
    const unreadMsgCount = unreadMsgCountResult?.count ?? 0;

    const stats = {
      newCount: Number(statsResult?.newCount ?? 0),
      pendingCount: Number(statsResult?.pendingCount ?? 0),
      shippingCount: Number(statsResult?.shippingCount ?? 0),
      overdueCount: Number(statsResult?.overdueCount ?? 0),
      unreadMessageCount: Number(unreadMsgCount ?? 0),
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
