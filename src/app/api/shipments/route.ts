import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { shipmentRecords, qcRecords } from '@/storage/database/shared/fulfillment';
import { orders, shops } from '@/storage/database/shared/schema';
import { eq, and, desc } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // pending / shipped
    const limit = Math.min(Number(searchParams.get('limit')) || 20, 100);
    const offset = Number(searchParams.get('offset')) || 0;

    // 查询待发货订单（已验货通过但未发货）
    const result = await db
      .select({
        order: orders,
        shop: shops,
        qc: qcRecords,
        shipment: shipmentRecords,
      })
      .from(orders)
      .leftJoin(shops, eq(orders.shopId, shops.id))
      .leftJoin(qcRecords, eq(orders.ozonOrderId, qcRecords.ozonOrderId))
      .leftJoin(shipmentRecords, eq(orders.id, shipmentRecords.orderId))
      .where(
        and(
          eq(orders.erpStatus, 'awaiting_deliver'),
          eq(qcRecords.qcResult, 'pass')
        )
      )
      .orderBy(desc(orders.createdAt))
      .limit(limit)
      .offset(offset);

    const items = result.map((item) => ({
      orderId: item.order.id,
      ozonOrderId: item.order.ozonOrderId,
      ozonPostingNumber: item.order.ozonPostingNumber,
      customerName: item.order.recipientName,
      deliveryAddress: item.order.recipientAddress,
      orderAmount: item.order.totalPrice,
      sku: '',
      productName: '',
      quantity: 1,
      shipmentId: item.shipment?.id || null,
      totalWeight: item.shipment?.packageWeight || null,
      ozonTrackingNumber: item.shipment?.trackingNumber || null,
      shipTime: item.shipment?.shippedAt || null,
      shopId: item.shop?.id || null,
      shopName: item.shop?.name || '',
    }));

    return NextResponse.json({ success: true, data: items, total: items.length });
  } catch (error) {
    console.error('[Shipments] GET error:', error);
    return NextResponse.json({ success: false, error: '获取发货队列失败' }, { status: 500 });
  }
}
