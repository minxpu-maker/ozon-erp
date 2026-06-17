import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { orderFinance } from '@/storage/database/shared/fulfillment';
import { orders } from '@/storage/database/shared/schema';
import { eq } from 'drizzle-orm';

interface SupplementRequest {
  orderId: string;
  purchaseCost: number;
  shippingFee?: number;
  otherCost?: number;
  notes?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SupplementRequest;
    const { orderId, purchaseCost, shippingFee, otherCost, notes } = body;

    if (!orderId) {
      return NextResponse.json({ success: false, error: 'orderId必填' }, { status: 400 });
    }

    // 检查订单是否存在
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order) {
      return NextResponse.json({ success: false, error: '订单不存在' }, { status: 404 });
    }

    // 计算总成本和利润
    const totalCost = purchaseCost + (shippingFee || 0) + (otherCost || 0);
    const totalPrice = Number(order.totalPrice) || 0;
    const profit = totalPrice - totalCost;
    const profitRate = totalPrice > 0 ? profit / totalPrice : 0;

    // 检查是否已有财务记录
    const [existing] = await db
      .select()
      .from(orderFinance)
      .where(eq(orderFinance.orderId, orderId))
      .limit(1);

    let record;
    if (existing) {
      [record] = await db
        .update(orderFinance)
        .set({
          purchaseAmount: String(purchaseCost),
          domesticShippingFee: shippingFee ? String(shippingFee) : null,
          otherCost: otherCost ? String(otherCost) : null,
          totalCost: String(totalCost),
          profit: String(profit),
          profitRate: String(profitRate),
          supplementNotes: notes || null,
          updatedAt: new Date(),
        })
        .where(eq(orderFinance.orderId, orderId))
        .returning();
    } else {
      [record] = await db
        .insert(orderFinance)
        .values({
          orderId,
          shopId: order.shopId,
          purchaseAmount: String(purchaseCost),
          domesticShippingFee: shippingFee ? String(shippingFee) : null,
          otherCost: otherCost ? String(otherCost) : null,
          totalCost: String(totalCost),
          profit: String(profit),
          profitRate: String(profitRate),
          supplementNotes: notes || null,
        })
        .returning();
    }

    return NextResponse.json({ success: true, data: record });
  } catch (error) {
    console.error('[Finance] Supplement error:', error);
    return NextResponse.json({ success: false, error: '补录失败' }, { status: 500 });
  }
}
