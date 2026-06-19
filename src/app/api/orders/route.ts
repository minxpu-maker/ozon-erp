import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { orders, shops as shopsTable } from '@/storage/database/shared/schema';
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
        shopName: shopsTable.name,
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
        ozonRawData: orders.ozonRawData,
      })
      .from(orders)
      .leftJoin(shopsTable, eq(orders.shopId, shopsTable.id))
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
    // Stats - 统计所有 Ozon 状态
    const [statsResult] = await db
      .select({
        total: count(),
        newCount: sql<number>`count(*) filter (where ${orders.erpStatus} in ('new','awaiting_pack','awaiting_packaging'))`,
        pendingCount: sql<number>`count(*) filter (where ${orders.erpStatus} in ('pending','pending_purchase','awaiting_deliver'))`,
        shippingCount: sql<number>`count(*) filter (where ${orders.erpStatus} in ('delivering','in_transit','verified','packed','shipped'))`,
        overdueCount: sql<number>`count(*) filter (where ${orders.shipmentDeadline} < now() and ${orders.erpStatus} not in ('shipped','delivered','cancelled'))`,
      })
      .from(orders);

    // 提取 ozon_raw_data 中的 products，合并 unreadMessageCount
    const orderList = orderListRaw.map((o: Record<string, unknown>) => {
      const rawData = o.ozonRawData as Record<string, unknown> | undefined;
      const rawProducts = rawData?.products as Array<Record<string, unknown>> | undefined;
      const products = (rawProducts || []).map((p: Record<string, unknown>) => ({
        name: String(p.name || ''),
        sku: String(p.sku || ''),
        quantity: Number(p.quantity || 1),
        price: String(p.price || '0'),
      }));
      return {
        ...o,
        products,
        unreadMessageCount: unreadMap.get(o.id as string) ?? 0,
      };
    });

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
