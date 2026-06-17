import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { shipmentRecords, orderFinance } from '@/storage/database/shared/fulfillment';
import { orders } from '@/storage/database/shared/schema';
import { eq } from 'drizzle-orm';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { trackingNumber, expressCompany, shippingFee } = body;

    // 查shipment记录
    const [record] = await db.select().from(shipmentRecords)
      .where(eq(shipmentRecords.id, id));

    if (!record) {
      return NextResponse.json({ error: '发货记录不存在' }, { status: 404 });
    }

    // 校验：必须先称重
    if (!record.packageWeight) {
      return NextResponse.json({ error: '请先完成称重再发货' }, { status: 400 });
    }

    // 1. 更新shipment_records
    const [updated] = await db.update(shipmentRecords)
      .set({
        trackingNumber: trackingNumber || record.trackingNumber,
        expressCompany: expressCompany || record.expressCompany,
        shippingFee: shippingFee?.toString() || record.shippingFee,
        shippedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(shipmentRecords.id, id))
      .returning();

    // 2. 更新orders表
    await db.update(orders)
      .set({
        isPacked: true,
        packedAt: new Date(),
        trackingNumber: trackingNumber || record.trackingNumber || null,
        shippedAt: new Date(),
        erpStatus: 'shipped',
      })
      .where(eq(orders.id, record.orderId));

    // 3. 自动创建order_finance记录（如不存在）
    const existingFinance = await db.select().from(orderFinance)
      .where(eq(orderFinance.orderId, record.orderId));

    if (existingFinance.length === 0) {
      // 查订单获取金额 - numeric 类型返回字符串
      const [order] = await db.select().from(orders)
        .where(eq(orders.id, record.orderId));

      const purchaseAmount = Number((order as any)?.purchasePrice || 0);
      const domesticShippingFee = Number(shippingFee || 0);
      const totalCost = purchaseAmount + domesticShippingFee;
      const settlement = Number((order as any)?.ozonSettlementAmount || 0);
      const profit = settlement - totalCost;
      const profitRate = settlement > 0 ? (profit / settlement) * 100 : 0;

      await db.insert(orderFinance).values({
        orderId: record.orderId,
        shopId: record.shopId,
        ozonSettlementAmount: String(settlement),
        purchaseAmount: String(purchaseAmount),
        domesticShippingFee: String(domesticShippingFee),
        totalCost: String(totalCost),
        profit: String(profit),
        profitRate: profitRate.toFixed(4),
        currency: 'RUB',
        isSettled: false,
      });
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Ship error:', error);
    return NextResponse.json({ error: '发货失败' }, { status: 500 });
  }
}
