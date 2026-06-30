import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { purchaseDemands } from '@/storage/database/shared/fulfillment';
import { orders, shops } from '@/storage/database/shared/schema';
import { eq, and, desc, isNull, sql } from 'drizzle-orm';

/**
 * GET /api/purchase-demands
 * 获取采购需求列表（待采购订单）
 * 返回 purchaseDemands + JOIN orders + shops 的数据
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';

    // 先查询采购需求
    const demands = await db
      .select()
      .from(purchaseDemands)
      .where(eq(purchaseDemands.status, status))
      .orderBy(desc(purchaseDemands.createdAt));

    // 如果没有需求，直接返回空数组
    if (demands.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
      });
    }

    // 批量查询关联的订单
    const orderIds = demands.map(d => d.orderId).filter(Boolean);
    const orderData = orderIds.length > 0 ? await db
      .select()
      .from(orders)
      .where(sql`${orders.id} IN ${orderIds}`) : [];

    // 批量查询店铺
    const shopIds = orderData.map(o => o.shopId).filter(Boolean);
    const shopData = shopIds.length > 0 ? await db
      .select()
      .from(shops)
      .where(sql`${shops.id} IN ${shopIds}`) : [];

    // 组装结果
    const result = demands.map(d => {
      const order = orderData.find(o => o.id === d.orderId);
      const shop = shopData.find(s => s.id === order?.shopId);
      return {
        id: d.id,
        orderId: d.orderId,
        sku: d.sku,
        productName: d.productName,
        productImage: d.productImage,
        quantity: d.quantity,
        priority: d.priority,
        status: d.status,
        createdAt: d.createdAt,
        order: order ? {
          id: order.id,
          postingNumber: order.ozonPostingNumber,
          status: order.status,
          erpStatus: order.erpStatus,
          shipmentDeadline: order.shipmentDeadline,
          shopId: order.shopId,
          totalPrice: order.totalPrice,
          shopName: shop?.name || null,
        } : null,
      };
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('获取采购需求失败:', error);
    return NextResponse.json(
      { success: false, error: '获取采购需求失败' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/purchase-demands
 * 创建采购需求（一般由订单同步自动创建，此接口用于手动补充）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, sku, productName, productImage, quantity, priority } = body;

    if (!orderId || !sku) {
      return NextResponse.json(
        { success: false, error: 'orderId 和 sku 为必填字段' },
        { status: 400 }
      );
    }

    const result = await db
      .insert(purchaseDemands)
      .values({
        orderId,
        sku,
        productName,
        productImage,
        quantity: quantity || 1,
        priority: priority || 'normal',
        status: 'pending',
      })
      .returning();

    return NextResponse.json({
      success: true,
      data: result[0],
    });
  } catch (error) {
    console.error('创建采购需求失败:', error);
    return NextResponse.json(
      { success: false, error: '创建采购需求失败' },
      { status: 500 }
    );
  }
}