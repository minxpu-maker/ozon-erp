import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { orderFinance } from '@/storage/database/shared/fulfillment';
import { eq } from 'drizzle-orm';

/**
 * POST /api/finance/supplement-cost
 * 成本补录
 * 将额外成本（包装费、二次物流费等）补录到 order_finance 表，并重新计算利润
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { orderId, otherCost, supplementNotes, domesticShippingFee, internationalShippingFee } = body;

  if (!orderId) {
    return NextResponse.json({ error: 'orderId 为必填' }, { status: 400 });
  }

  // 查现有财务记录
  const [existing] = await db.select().from(orderFinance)
    .where(eq(orderFinance.orderId, orderId));

  if (!existing) {
    return NextResponse.json({ error: '该订单暂无财务记录，请先完成发货' }, { status: 404 });
  }

  // 合并费用
  const newOtherCost = Number(otherCost || 0) + Number(existing.otherCost || 0);
  const newDomesticFee = domesticShippingFee
    ? Number(domesticShippingFee)
    : Number(existing.domesticShippingFee || 0);
  const newIntlFee = internationalShippingFee
    ? Number(internationalShippingFee)
    : Number(existing.internationalShippingFee || 0);

  // 重新计算总成本和利润
  const purchaseAmount = Number(existing.purchaseAmount || 0);
  const totalCost = purchaseAmount + newDomesticFee + newIntlFee + newOtherCost;
  const settlement = Number(existing.ozonSettlementAmount || 0);
  const profit = settlement - totalCost;
  const profitRate = settlement > 0 ? (profit / settlement) * 100 : 0;

  // 拼接补录备注
  const newNotes = supplementNotes
    ? (existing.supplementNotes ? existing.supplementNotes + '；' : '') + supplementNotes
    : existing.supplementNotes;

  const [updated] = await db.update(orderFinance)
    .set({
      otherCost: newOtherCost.toString(),
      domesticShippingFee: newDomesticFee.toString(),
      internationalShippingFee: newIntlFee.toString(),
      totalCost: totalCost.toString(),
      profit: profit.toString(),
      profitRate: profitRate.toFixed(4),
      supplementNotes: newNotes,
      updatedAt: new Date(),
    })
    .where(eq(orderFinance.id, existing.id))
    .returning();

  return NextResponse.json({ success: true, data: updated });
}
