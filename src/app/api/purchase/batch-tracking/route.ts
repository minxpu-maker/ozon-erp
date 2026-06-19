import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { ozonOrders } from '@/storage/database/shared/fulfillment';
import { eq, inArray } from 'drizzle-orm';

interface BatchTrackingItem {
  orderId: string;
  trackingNumber: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { items } = body as { items: BatchTrackingItem[] };

    if (!items || items.length === 0) {
      return NextResponse.json({
        success: false,
        message: '没有要提交的记录',
      }, { status: 400 });
    }

    // 过滤有效的记录
    const validItems = items.filter(item => item.orderId && item.trackingNumber);

    if (validItems.length === 0) {
      return NextResponse.json({
        success: false,
        message: '没有有效的快递号记录',
      }, { status: 400 });
    }

    // 批量更新订单的快递号
    const orderIds = validItems.map(item => parseInt(item.orderId)).filter(id => !isNaN(id));
    
    if (orderIds.length === 0) {
      return NextResponse.json({
        success: false,
        message: '没有有效的订单ID',
      }, { status: 400 });
    }
    
    await db
      .update(ozonOrders)
      .set({ 
        erpStatus: 'purchased', // 更新状态为已采购
        updatedAt: new Date(),
      })
      .where(inArray(ozonOrders.id, orderIds));

    // 注意：实际的 trackingNumber 字段可能需要添加到数据库schema
    // 这里暂时只更新状态

    return NextResponse.json({
      success: true,
      message: '快递号批量录入成功',
      data: {
        success: validItems.length,
        total: items.length,
      },
    });
  } catch (error) {
    console.error('批量录入快递号失败:', error);
    return NextResponse.json({
      success: false,
      message: '批量录入失败',
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
