import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { purchaseDemands } from '@/storage/database/shared/fulfillment';
import { orders, shops } from '@/storage/database/shared/schema';
import { eq, and, desc, isNull, isNotNull, sql } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';
    const shopId = searchParams.get('shopId');

    // 直接从 orders 表查询 awaiting_deliver 状态作为待采购任务
    const queryConditions = [eq(orders.status, 'awaiting_deliver')];
    
    if (shopId) {
      queryConditions.push(eq(orders.shopId, shopId));
    }

    const results = await db
      .select({
        // 采购需求字段
        id: purchaseDemands.id,
        orderId: purchaseDemands.orderId,
        sku: purchaseDemands.sku,
        productName: purchaseDemands.productName,
        productImage: purchaseDemands.productImage,
        quantity: purchaseDemands.quantity,
        priority: purchaseDemands.priority,
        demandStatus: purchaseDemands.status,
        createdAt: purchaseDemands.createdAt,
        // 订单字段
        orderId2: orders.id,
        postingNumber: orders.ozonPostingNumber,
        orderStatus: orders.status,
        erpStatus: orders.erpStatus,
        shipmentDeadline: orders.shipmentDeadline,
        shopId: orders.shopId,
        totalPrice: orders.totalPrice,
        createdAt2: orders.createdAt,
        // 店铺字段
        shopName: shops.name,
      })
      .from(orders)
      .leftJoin(
        purchaseDemands,
        sql`${purchaseDemands.orderId} = ${orders.id}::uuid`
      )
      .leftJoin(
        shops,
        eq(orders.shopId, shops.id)
      )
      .where(and(...queryConditions))
      .orderBy(desc(orders.createdAt));

    // 格式化结果
    const formattedData = results.map(row => ({
      id: row.id,
      orderId: row.orderId || row.orderId2,
      sku: row.sku,
      productName: row.productName || '待采购商品',
      productImage: row.productImage,
      quantity: row.quantity || 1,
      priority: row.priority || 'normal',
      status: row.demandStatus || (row.orderId2 ? 'pending' : null),
      createdAt: row.createdAt || row.createdAt2,
      order: row.orderId2 ? {
        id: row.orderId2,
        postingNumber: row.postingNumber,
        status: row.orderStatus,
        erpStatus: row.erpStatus,
        shipmentDeadline: row.shipmentDeadline,
        shopId: row.shopId,
        shopName: row.shopName,
        totalPrice: row.totalPrice,
      } : null,
    }));

    // 如果没有采购需求但有待采购订单，创建虚拟采购需求
    const demandsWithOrders = formattedData.filter(d => d.order);

    return NextResponse.json({
      success: true,
      data: demandsWithOrders,
      total: demandsWithOrders.length,
    });

  } catch (error) {
    console.error('获取采购需求失败:', error);
    return NextResponse.json(
      { success: false, error: '获取采购需求失败' },
      { status: 500 }
    );
  }
}
