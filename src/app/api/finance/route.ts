import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import * as schema from '@/storage/database/shared/schema';
import { eq, desc } from 'drizzle-orm';

// 获取财务核算列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const shopId = searchParams.get('shopId');

    // 获取已发货但未结算的订单
    const orders = await db.select().from(schema.orders)
      .where(eq(schema.orders.is_settled, false))
      .orderBy(desc(schema.orders.shipped_at));

    // 获取已结算的财务记录
    const records = await db.select().from(schema.financeRecords)
      .orderBy(desc(schema.financeRecords.settled_at));

    return NextResponse.json({ 
      success: true, 
      data: { 
        pendingOrders: orders,
        settledRecords: records,
      } 
    });
  } catch (error) {
    console.error('获取财务数据失败:', error);
    return NextResponse.json({ success: false, error: '获取财务数据失败' }, { status: 500 });
  }
}

// 执行利润核算
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId } = body;

    // 获取订单
    const [order] = await db.select().from(schema.orders)
      .where(eq(schema.orders.id, orderId));

    if (!order) {
      return NextResponse.json({ success: false, error: '订单不存在' }, { status: 404 });
    }

    // 获取采购成本
    const purchaseTasks = await db.select().from(schema.purchaseTasks)
      .where(eq(schema.purchaseTasks.order_id, orderId));

    let totalCost = 0;
    for (const task of purchaseTasks) {
      totalCost += parseFloat(task.purchase_amount || '0');
      totalCost += parseFloat(task.shipping_fee || '0');
    }

    // 保存利润记录
    const revenue = parseFloat(order.total_price || '0');
    const profit = revenue - totalCost;

    await db.insert(schema.financeRecords).values({
      order_id: orderId,
      ozon_settlement_amount: revenue.toString(),
      purchase_cost: totalCost.toString(),
      domestic_shipping_cost: '0',
      package_cost: '0',
      ozon_commission: '0',
      other_cost: '0',
      after_sale_loss: '0',
      gross_profit: profit.toString(),
      net_profit: profit.toString(),
      is_settled: true,
      settled_at: new Date(),
    });

    // 更新订单结算状态
    await db
      .update(schema.orders)
      .set({ is_settled: true })
      .where(eq(schema.orders.id, orderId));

    return NextResponse.json({
      success: true,
      data: { revenue, totalCost, profit },
      message: '利润核算完成',
    });
  } catch (error) {
    console.error('利润核算失败:', error);
    return NextResponse.json({ success: false, error: '利润核算失败' }, { status: 500 });
  }
}
