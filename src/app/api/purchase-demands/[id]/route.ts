import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { purchaseDemands, ozonOrders } from '@/storage/database/shared/schema';
import { eq } from "drizzle-orm";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const demandId = parseInt(id, 10);
    
    if (isNaN(demandId)) {
      return NextResponse.json(
        { success: false, error: '无效的需求ID' },
        { status: 400 }
      );
    }

    const result = await db
      .select({
        id: purchaseDemands.id,
        orderId: purchaseDemands.orderId,
        sku: purchaseDemands.sku,
        productName: purchaseDemands.productName,
        productImage: purchaseDemands.productImage,
        quantity: purchaseDemands.quantity,
        priority: purchaseDemands.priority,
        status: purchaseDemands.status,
        createdAt: purchaseDemands.createdAt,
        updatedAt: purchaseDemands.updatedAt,
        // 订单信息
        orderStatus: ozonOrders.orderStatus,
        erpStatus: ozonOrders.erpStatus,
        orderAmount: ozonOrders.orderAmount,
        shipmentDeadline: ozonOrders.shipmentDeadline,
        orderTime: ozonOrders.orderTime,
        deliveryAddress: ozonOrders.deliveryAddress,
        itemsJson: ozonOrders.itemsJson,
      })
      .from(purchaseDemands)
      .leftJoin(ozonOrders, eq(ozonOrders.id, purchaseDemands.orderId))
      .where(eq(purchaseDemands.id, demandId))
      .limit(1);

    if (result.length === 0) {
      return NextResponse.json(
        { success: false, error: '采购需求不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        ...result[0],
        orderAmount: result[0].orderAmount ? Number(result[0].orderAmount) : null,
      },
    });
  } catch (error) {
    console.error('Error fetching purchase demand:', error);
    return NextResponse.json(
      { success: false, error: '获取采购需求详情失败' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const demandId = parseInt(id, 10);
    
    if (isNaN(demandId)) {
      return NextResponse.json(
        { success: false, error: '无效的需求ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { status } = body;

    // 验证状态值
    const validStatuses = ['pending', 'purchased', 'cancelled'];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, error: '无效的状态值' },
        { status: 400 }
      );
    }

    // 检查需求是否存在
    const existing = await db
      .select()
      .from(purchaseDemands)
      .where(eq(purchaseDemands.id, demandId))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json(
        { success: false, error: '采购需求不存在' },
        { status: 404 }
      );
    }

    // 更新
    await db.update(purchaseDemands)
      .set({
        ...(status && { status }),
        updatedAt: new Date(),
      })
      .where(eq(purchaseDemands.id, demandId));

    return NextResponse.json({
      success: true,
      message: '采购需求更新成功',
    });
  } catch (error) {
    console.error('Error updating purchase demand:', error);
    return NextResponse.json(
      { success: false, error: '更新采购需求失败' },
      { status: 500 }
    );
  }
}
