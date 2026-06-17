import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { shipmentRecords } from '@/storage/database/shared/fulfillment';
import { orders, shops } from '@/storage/database/shared/schema';
import { eq, and, desc, isNull, isNotNull } from 'drizzle-orm';

/**
 * GET /api/finance/freight
 * 运费核对列表
 * - reconciled=true/false: 按核对状态筛选
 * - shopId: 按店铺筛选
 * - offset/limit: 分页
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const reconciled = searchParams.get('reconciled');
  const shopId = searchParams.get('shopId');
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
  const offset = parseInt(searchParams.get('offset') || '0');

  const conditions = [];

  if (reconciled === 'true') {
    conditions.push(eq(shipmentRecords.freightReconciled, true));
  } else if (reconciled === 'false') {
    conditions.push(eq(shipmentRecords.freightReconciled, false));
  }

  if (shopId) {
    conditions.push(eq(shipmentRecords.shopId, shopId));
  }

  const whereClause = conditions.length > 0
    ? (conditions.length === 1 ? conditions[0] : and(...conditions))
    : undefined;

  const data = await db
    .select({
      shipment: {
        id: shipmentRecords.id,
        orderId: shipmentRecords.orderId,
        shopId: shipmentRecords.shopId,
        expressCompany: shipmentRecords.expressCompany,
        expressNo: shipmentRecords.expressNo,
        packageWeight: shipmentRecords.packageWeight,
        shippingFee: shipmentRecords.shippingFee,
        actualShippingFee: shipmentRecords.actualShippingFee,
        freightReconciled: shipmentRecords.freightReconciled,
        reconciledAt: shipmentRecords.reconciledAt,
        shippedAt: shipmentRecords.shippedAt,
        trackingNumber: shipmentRecords.trackingNumber,
        createdAt: shipmentRecords.createdAt,
      },
      order: {
        id: orders.id,
        ozonOrderId: orders.ozonOrderId,
        ozonPostingNumber: orders.ozonPostingNumber,
        buyerName: orders.buyerName,
        recipientCity: orders.recipientCity,
        erpStatus: orders.erpStatus,
      },
      shop: {
        id: shops.id,
        name: shops.name,
      },
    })
    .from(shipmentRecords)
    .leftJoin(orders, eq(shipmentRecords.orderId, orders.id))
    .leftJoin(shops, eq(shipmentRecords.shopId, shops.id))
    .where(whereClause)
    .orderBy(desc(shipmentRecords.createdAt))
    .limit(limit)
    .offset(offset);

  // 计算运费差异
  const result = data.map((item) => ({
    ...item,
    freightDiff: item.shipment.shippingFee && item.shipment.actualShippingFee
      ? Number(item.shipment.actualShippingFee) - Number(item.shipment.shippingFee)
      : null,
  }));

  return NextResponse.json({ success: true, data: result, offset, limit });
}
