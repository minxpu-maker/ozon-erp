import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import * as schema from '@/storage/database/shared/schema';
import { eq, desc } from 'drizzle-orm';

// 获取入库验货任务列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const trackingNumber = searchParams.get('trackingNumber');

    // 如果提供了快递单号，查找对应的采购任务
    if (trackingNumber) {
      const [task] = await db.select().from(schema.purchaseTasks)
        .where(eq(schema.purchaseTasks.domestic_tracking_number, trackingNumber));

      if (!task) {
        return NextResponse.json({ success: false, error: '未找到对应采购任务' }, { status: 404 });
      }

      // 获取关联订单
      const [order] = await db.select().from(schema.orders)
        .where(eq(schema.orders.id, task.order_id));

      return NextResponse.json({ 
        success: true, 
        data: { task, order },
      });
    }

    // 获取待验货的采购任务（已采购但订单未验货）
    const tasks = await db.select({
      task: schema.purchaseTasks,
      order: schema.orders,
    }).from(schema.purchaseTasks)
      .leftJoin(schema.orders, eq(schema.purchaseTasks.order_id, schema.orders.id))
      .where(eq(schema.purchaseTasks.status, 'purchased'))
      .orderBy(desc(schema.purchaseTasks.purchased_at));

    return NextResponse.json({ success: true, data: tasks });
  } catch (error) {
    console.error('获取验货任务失败:', error);
    return NextResponse.json({ success: false, error: '获取验货任务失败' }, { status: 500 });
  }
}

// 完成验货
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskId, result, remark } = body;

    // 获取采购任务
    const [task] = await db.select().from(schema.purchaseTasks)
      .where(eq(schema.purchaseTasks.id, taskId));

    if (!task) {
      return NextResponse.json({ success: false, error: '采购任务不存在' }, { status: 404 });
    }

    // 更新订单验货状态
    await db.update(schema.orders)
      .set({ is_inspected: true })
      .where(eq(schema.orders.id, task.order_id));

    // 更新采购任务状态
    await db.update(schema.purchaseTasks)
      .set({ status: result === 'pass' ? 'inspected' : 'failed' })
      .where(eq(schema.purchaseTasks.id, taskId));

    // 如果验货不合格，创建售后工单
    if (result === 'fail') {
      // TODO: 创建售后工单
    }

    return NextResponse.json({ 
      success: true, 
      message: result === 'pass' ? '验货通过' : '验货不合格，已创建售后工单',
    });
  } catch (error) {
    console.error('验货失败:', error);
    return NextResponse.json({ success: false, error: '验货失败' }, { status: 500 });
  }
}
