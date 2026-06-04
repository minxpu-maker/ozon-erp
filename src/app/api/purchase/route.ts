import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import * as schema from '@/storage/database/shared/schema';
import { eq, desc } from 'drizzle-orm';

// 获取采购任务列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let query = db.select({
      task: schema.purchaseTasks,
      order: schema.orders,
    }).from(schema.purchaseTasks)
      .leftJoin(schema.orders, eq(schema.purchaseTasks.order_id, schema.orders.id))
      .orderBy(desc(schema.purchaseTasks.created_at));

    if (status) {
      // Note: 需要在leftJoin之前添加where条件
      const tasks = await db.select({
        task: schema.purchaseTasks,
        order: schema.orders,
      }).from(schema.purchaseTasks)
        .leftJoin(schema.orders, eq(schema.purchaseTasks.order_id, schema.orders.id))
        .where(eq(schema.purchaseTasks.status, status))
        .orderBy(desc(schema.purchaseTasks.created_at));

      return NextResponse.json({ success: true, data: tasks });
    }

    const tasks = await query;

    return NextResponse.json({ success: true, data: tasks });
  } catch (error) {
    console.error('获取采购任务失败:', error);
    return NextResponse.json({ success: false, error: '获取采购任务失败' }, { status: 500 });
  }
}

// 创建采购任务或绑定快递单号
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, taskId, trackingNumber, orderId, orderItemId, skuCode, quantity, sourceType, sourceUrl, sourcePrice } = body;

    // 绑定快递单号操作
    if (action === 'bindTracking') {
      if (!taskId || !trackingNumber) {
        return NextResponse.json({ success: false, error: '缺少任务ID或快递单号' }, { status: 400 });
      }

      // 更新采购任务状态
      const [updatedTask] = await db.update(schema.purchaseTasks)
        .set({
          domestic_tracking_number: trackingNumber,
          status: 'purchased',
          is_bound: true,
          purchased_at: new Date(),
          updated_at: new Date(),
        })
        .where(eq(schema.purchaseTasks.id, taskId))
        .returning();

      // 更新关联订单的采购绑定状态
      if (updatedTask.order_id) {
        await db.update(schema.orders)
          .set({
            is_purchase_bound: true,
            purchase_bound_at: new Date(),
          })
          .where(eq(schema.orders.id, updatedTask.order_id));
      }

      return NextResponse.json({ 
        success: true, 
        data: updatedTask, 
        message: '快递单号绑定成功，订单已流转至入库验货模块' 
      });
    }

    // 创建采购任务
    const [task] = await db.insert(schema.purchaseTasks).values({
      order_id: orderId,
      order_item_id: orderItemId || '',
      status: 'pending',
      sku_id: null,
      sku_code: skuCode || '',
      quantity: quantity || 1,
      source_type: sourceType || null,
      source_url: sourceUrl || null,
      source_price: sourcePrice || null,
      purchase_amount: null,
      shipping_fee: null,
      domestic_tracking_number: null,
      purchased_at: null,
    }).returning();

    return NextResponse.json({ success: true, data: task, message: '采购任务创建成功' });
  } catch (error) {
    console.error('操作失败:', error);
    return NextResponse.json({ success: false, error: '操作失败' }, { status: 500 });
  }
}
