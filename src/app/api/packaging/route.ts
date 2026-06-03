import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import * as schema from '@/storage/database/shared/schema';
import { eq, desc } from 'drizzle-orm';

// 获取待打包订单列表
export async function GET(request: NextRequest) {
  try {
    // 获取已验货但未打包的订单
    const orders = await db.select().from(schema.orders)
      .where(eq(schema.orders.is_inspected, true))
      .orderBy(desc(schema.orders.created_at));

    return NextResponse.json({ success: true, data: orders });
  } catch (error) {
    console.error('获取打包任务失败:', error);
    return NextResponse.json({ success: false, error: '获取打包任务失败' }, { status: 500 });
  }
}

// 完成打包
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, weight } = body;

    // 获取订单
    const [order] = await db.select().from(schema.orders)
      .where(eq(schema.orders.id, orderId));

    if (!order) {
      return NextResponse.json({ success: false, error: '订单不存在' }, { status: 404 });
    }

    // 更新订单打包状态
    await db.update(schema.orders)
      .set({ 
        is_packed: true,
        shipped_at: new Date(),
      })
      .where(eq(schema.orders.id, orderId));

    // TODO: 调用Ozon API打印面单
    // TODO: 记录包裹重量

    return NextResponse.json({ 
      success: true, 
      data: { orderId, weight },
      message: '打包完成',
    });
  } catch (error) {
    console.error('打包失败:', error);
    return NextResponse.json({ success: false, error: '打包失败' }, { status: 500 });
  }
}
