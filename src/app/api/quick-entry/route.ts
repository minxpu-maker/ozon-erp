import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import * as schema from '@/storage/database/shared/schema';
import { eq } from 'drizzle-orm';

// 快捷录单 - 绑定采购信息
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, trackingNumber, purchaseAmount, shippingFee, sourceType } = body;

    // 查找订单
    const [order] = await db.select().from(schema.orders)
      .where(eq(schema.orders.id, orderId));

    if (!order) {
      return NextResponse.json({ success: false, error: '订单不存在' }, { status: 404 });
    }

    // 更新采购任务
    const [task] = await db.insert(schema.purchaseTasks).values({
      order_id: orderId,
      order_item_id: '',
      status: 'purchased',
      sku_id: null,
      sku_code: '',
      quantity: 1,
      source_type: sourceType || 'manual',
      source_url: null,
      source_price: purchaseAmount || null,
      purchase_amount: purchaseAmount || null,
      shipping_fee: shippingFee || null,
      domestic_tracking_number: trackingNumber || null,
      purchased_at: new Date(),
    }).returning();

    // 更新订单绑定状态
    await db.update(schema.orders)
      .set({ isPurchaseBound: true })
      .where(eq(schema.orders.id, orderId));

    return NextResponse.json({ 
      success: true, 
      data: { orderId, trackingNumber, task },
      message: '采购绑定成功' 
    });
  } catch (error) {
    console.error('快捷录单失败:', error);
    return NextResponse.json({ success: false, error: '快捷录单失败' }, { status: 500 });
  }
}

// 获取待绑定订单列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');

    // 获取未绑定采购的订单
    let orders = await db.select().from(schema.orders)
      .where(eq(schema.orders.isPurchaseBound, false));

    // 搜索过滤
    if (search) {
      orders = orders.filter(o => 
        o.ozonOrderId.includes(search) || 
        o.ozonPostingNumber.includes(search)
      );
    }

    return NextResponse.json({ success: true, data: orders });
  } catch (error) {
    console.error('获取待绑定订单失败:', error);
    return NextResponse.json({ success: false, error: '获取待绑定订单失败' }, { status: 500 });
  }
}
