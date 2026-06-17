import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { ozonOrders, purchaseDemands } from '@/storage/database/shared/fulfillment';
import { eq, like, and, gte, lte, desc, sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const shopId = searchParams.get('shopId');
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const offset = (page - 1) * pageSize;

    // 构建查询条件
    const conditions = [];

    if (shopId) {
      conditions.push(eq(ozonOrders.shopId, shopId));
    }

    if (status) {
      conditions.push(eq(ozonOrders.erpStatus, status));
    }

    if (startDate) {
      conditions.push(gte(ozonOrders.createdAt, new Date(startDate)));
    }

    if (endDate) {
      conditions.push(lte(ozonOrders.createdAt, new Date(endDate + 'T23:59:59')));
    }

    if (search) {
      conditions.push(like(ozonOrders.ozonPostingNumber, `%${search}%`));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // 查询订单
    const orders = await db
      .select({
        id: ozonOrders.id,
        ozonPostingNumber: ozonOrders.ozonPostingNumber,
        orderAmount: ozonOrders.orderAmount,
        erpStatus: ozonOrders.erpStatus,
        shipmentDeadline: ozonOrders.shipmentDeadline,
        orderTime: ozonOrders.orderTime,
        createdAt: ozonOrders.createdAt,
        shopId: ozonOrders.shopId,
      })
      .from(ozonOrders)
      .where(whereClause)
      .orderBy(desc(ozonOrders.createdAt))
      .limit(pageSize)
      .offset(offset);

    // 统计总数
    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(ozonOrders)
      .where(whereClause);

    const total = Number(totalResult[0]?.count) || 0;

    // 获取每个订单的第一个采购需求（用于显示商品信息）
    const ordersWithProducts = await Promise.all(
      orders.map(async (order) => {
        const demands = await db
          .select({
            productName: purchaseDemands.productName,
            sku: purchaseDemands.sku,
            productImage: purchaseDemands.productImage,
            quantity: purchaseDemands.quantity,
          })
          .from(purchaseDemands)
          .where(eq(purchaseDemands.orderId, order.id))
          .limit(1);

        const demand = demands[0] || {
          productName: '未知商品',
          sku: '-',
          productImage: null,
          quantity: 1,
        };

        return {
          ...order,
          productName: demand.productName,
          sku: demand.sku,
          productImage: demand.productImage,
          quantity: demand.quantity,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: ordersWithProducts,
      total,
      page,
      pageSize,
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    return NextResponse.json(
      { success: false, error: '获取订单列表失败' },
      { status: 500 }
    );
  }
}
