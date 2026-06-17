import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { purchaseTasks, orders, orderItems } from '@/storage/database/shared/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { expressNo } = body;

  if (!expressNo) {
    return NextResponse.json({ error: 'expressNo 为必填' }, { status: 400 });
  }

  // 1. 按快递单号查采购任务
  const tasks = await db.select({
    task: purchaseTasks,
    order: orders,
  })
  .from(purchaseTasks)
  .leftJoin(orders, eq(purchaseTasks.order_id, orders.id))
  .where(eq(purchaseTasks.domestic_tracking_number, expressNo));

  if (tasks.length === 0) {
    return NextResponse.json({ 
      found: false, 
      message: '未找到该快递单号对应的采购任务' 
    }, { status: 404 });
  }

  const task = tasks[0];
  if (!task.order) {
    return NextResponse.json({ 
      found: false, 
      message: '采购任务未绑定订单' 
    }, { status: 404 });
  }

  // 2. 查订单商品明细
  const items = await db.select().from(orderItems)
    .where(eq(orderItems.order_id, task.order.id));

  // 3. 查是否已验货
  const isInspected = task.order.isInspected;

  return NextResponse.json({
    found: true,
    data: {
      task: {
        id: task.task.id,
        status: task.task.status,
        skuCode: task.task.sku_code,
        quantity: task.task.quantity,
        sourceType: task.task.source_type,
        sourceUrl: task.task.source_url,
        sourcePrice: task.task.source_price,
        purchaseAmount: task.task.purchase_amount,
      },
      order: {
        id: task.order.id,
        ozonOrderId: task.order.ozonOrderId,
        ozonPostingNumber: task.order.ozonPostingNumber,
        status: task.order.status,
        buyerName: task.order.buyerName,
        recipientName: task.order.recipientName,
        recipientPhone: task.order.recipientPhone,
        recipientCity: task.order.recipientCity,
        recipientAddress: task.order.recipientAddress,
        isInspected,
        inspectedAt: task.order.inspectedAt,
      },
      items: items.map((item: typeof orderItems.$inferSelect) => ({
        id: item.id,
        sku: item.sku,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        inspectedQuantity: item.inspected_quantity,
      })),
    },
  });
}
