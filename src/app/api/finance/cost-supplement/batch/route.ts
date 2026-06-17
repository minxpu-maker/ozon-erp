import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { orders, orderFinance } from '@/storage/database/shared/schema';
import { eq, inArray } from 'drizzle-orm';

interface CostItem {
  orderId: string;
  purchaseCost?: number;
  shippingFee?: number;
  otherCost?: number;
  supplierSource?: string;
  supplierName?: string;
  notes?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { items } = body as { items: CostItem[] };

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: 'items不能为空' }, { status: 400 });
    }

    const results: Array<{ orderId: string; success: boolean; error?: string }> = [];

    for (const item of items) {
      if (!item.orderId) {
        results.push({ orderId: item.orderId || '', success: false, error: 'orderId必填' });
        continue;
      }

      // 检查订单是否存在
      const order = await db.select().from(orders).where(eq(orders.id, item.orderId)).limit(1);
      if (order.length === 0) {
        results.push({ orderId: item.orderId, success: false, error: '订单不存在' });
        continue;
      }

      // 计算总成本
      const orderTotalPrice = order[0].totalPrice;
      const totalPriceNum = orderTotalPrice ? Number(orderTotalPrice) : 0;
      const totalCost = (item.purchaseCost || 0) + (item.shippingFee || 0) + (item.otherCost || 0);
      const profit = totalPriceNum - totalCost;
      const profitRate = totalPriceNum > 0 ? profit / totalPriceNum : 0;

      // 检查是否已有财务记录
      const existingFinance = await db
        .select()
        .from(orderFinance)
        .where(eq(orderFinance.orderId, item.orderId))
        .limit(1);

      if (existingFinance.length > 0) {
        // 更新
        await db
          .update(orderFinance)
          .set({
            purchaseAmount: item.purchaseCost ? String(item.purchaseCost) : null,
            domesticShippingFee: item.shippingFee ? String(item.shippingFee) : null,
            otherCost: item.otherCost ? String(item.otherCost) : null,
            totalCost: String(totalCost),
            profit: String(profit),
            profitRate: String(profitRate),
            supplementNotes: item.notes || null,
            updatedAt: new Date(),
          })
          .where(eq(orderFinance.orderId, item.orderId));
      } else {
        // 创建
        await db.insert(orderFinance).values({
          orderId: item.orderId,
          shopId: order[0].shopId,
          purchaseAmount: item.purchaseCost ? String(item.purchaseCost) : null,
          domesticShippingFee: item.shippingFee ? String(item.shippingFee) : null,
          otherCost: item.otherCost ? String(item.otherCost) : null,
          totalCost: String(totalCost),
          profit: String(profit),
          profitRate: String(profitRate),
          supplementNotes: item.notes || null,
        });
      }

      results.push({ orderId: item.orderId, success: true });
    }

    const successCount = results.filter((r) => r.success).length;
    return NextResponse.json({
      success: true,
      data: { results, summary: { total: results.length, success: successCount, failed: results.length - successCount } },
    });
  } catch (error) {
    console.error('[Finance] Batch cost supplement error:', error);
    return NextResponse.json({ success: false, error: '批量补录成本失败' }, { status: 500 });
  }
}
