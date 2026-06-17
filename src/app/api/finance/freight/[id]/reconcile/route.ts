import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { shipmentRecords, orderFinance } from '@/storage/database/shared/fulfillment';
import { eq } from 'drizzle-orm';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { actualShippingFee } = body;

  // 查shipment记录
  const [record] = await db.select().from(shipmentRecords)
    .where(eq(shipmentRecords.id, id));

  if (!record) {
    return NextResponse.json({ error: '发货记录不存在' }, { status: 404 });
  }

  // 更新运费核对状态
  const finalFee = actualShippingFee
    ? actualShippingFee.toString()
    : record.actualShippingFee || record.shippingFee;

  const [updated] = await db.update(shipmentRecords)
    .set({
      actualShippingFee: finalFee,
      freightReconciled: true,
      reconciledAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(shipmentRecords.id, id))
    .returning();

  // 同步更新order_finance的运费和利润
  const [finance] = await db.select().from(orderFinance)
    .where(eq(orderFinance.orderId, record.orderId));

  if (finance) {
    const purchaseAmount = Number(finance.purchaseAmount || 0);
    const domesticFee = Number(finalFee);
    const otherCost = Number(finance.otherCost || 0);
    const intlFee = Number(finance.internationalShippingFee || 0);
    const totalCost = purchaseAmount + domesticFee + intlFee + otherCost;
    const settlement = Number(finance.ozonSettlementAmount || 0);
    const profit = settlement - totalCost;
    const profitRate = settlement > 0 ? (profit / settlement) * 100 : 0;

    await db.update(orderFinance)
      .set({
        domesticShippingFee: domesticFee.toString(),
        totalCost: totalCost.toString(),
        profit: profit.toString(),
        profitRate: profitRate.toFixed(4),
        updatedAt: new Date(),
      })
      .where(eq(orderFinance.id, finance.id));
  }

  return NextResponse.json({ success: true, data: updated });
}
