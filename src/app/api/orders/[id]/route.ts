import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { orders, orderItems } from '@/storage/database/shared/schema';
import { eq } from 'drizzle-orm';

// GET /api/orders/[id] - 获取订单详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 查询订单
    const orderList = await db
      .select()
      .from(orders)
      .where(eq(orders.id, id))
      .limit(1);

    if (orderList.length === 0) {
      return NextResponse.json(
        { success: false, error: '订单不存在' },
        { status: 404 }
      );
    }

    const order = orderList[0];

    // 查询订单商品
    const items = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.order_id, id));

    return NextResponse.json({
      success: true,
      data: {
        order: {
          id: order.id,
          ozonOrderId: order.ozon_order_id,
          postingNumber: order.ozon_posting_number,
          shopId: order.shop_id,
          status: order.status,
          buyerName: order.buyer_name,
          buyerPhone: order.buyer_phone,
          recipientName: order.recipient_name,
          recipientPhone: order.recipient_phone,
          recipientCity: order.recipient_city,
          recipientAddress: order.recipient_address,
          totalPrice: order.total_price,
          productsPrice: order.products_price,
          deliveryPrice: order.delivery_price,
          trackingNumber: order.tracking_number,
          shippedAt: order.shipped_at,
          deliveredAt: order.delivered_at,
          isPurchaseBound: order.is_purchase_bound,
          purchaseBoundAt: order.purchase_bound_at,
          isInspected: order.is_inspected,
          inspectedAt: order.inspected_at,
          isPacked: order.is_packed,
          packedAt: order.packed_at,
          packageWeight: order.package_weight,
          isSettled: order.is_settled,
          settledAt: order.settled_at,
          createdAt: order.created_at,
          updatedAt: order.updated_at,
          ozonCreatedAt: order.ozon_created_at,
          ozonUpdatedAt: order.ozon_updated_at,
        },
        items: items.map(item => ({
          id: item.id,
          orderId: item.order_id,
          sku: item.sku,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          ozonOfferId: item.ozon_offer_id,
          ozonProductId: item.ozon_product_id,
          sourceType: item.source_type,
          sourceUrl: item.source_url,
          sourcePrice: item.source_price,
          inspectedQuantity: item.inspected_quantity,
          isInspected: item.is_inspected,
        })),
      },
    });
  } catch (error) {
    console.error('获取订单详情失败:', error);
    return NextResponse.json(
      { success: false, error: '获取订单详情失败' },
      { status: 500 }
    );
  }
}

// PATCH /api/orders/[id] - 更新订单状态
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updateData: Record<string, unknown> = {
      updated_at: new Date(),
    };

    if (body.status) {
      updateData.status = body.status;
    }
    if (body.trackingNumber !== undefined) {
      updateData.tracking_number = body.trackingNumber;
    }
    if (body.isPurchaseBound !== undefined) {
      updateData.is_purchase_bound = body.isPurchaseBound;
      updateData.purchase_bound_at = body.isPurchaseBound ? new Date() : null;
    }
    if (body.isInspected !== undefined) {
      updateData.is_inspected = body.isInspected;
      updateData.inspected_at = body.isInspected ? new Date() : null;
    }
    if (body.isPacked !== undefined) {
      updateData.is_packed = body.isPacked;
      updateData.packed_at = body.isPacked ? new Date() : null;
    }
    if (body.packageWeight !== undefined) {
      updateData.package_weight = body.packageWeight;
    }

    await db.update(orders).set(updateData).where(eq(orders.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('更新订单失败:', error);
    return NextResponse.json(
      { success: false, error: '更新订单失败' },
      { status: 500 }
    );
  }
}

// DELETE /api/orders/[id] - 删除订单
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 删除订单商品
    await db.delete(orderItems).where(eq(orderItems.order_id, id));
    
    // 删除订单
    await db.delete(orders).where(eq(orders.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除订单失败:', error);
    return NextResponse.json(
      { success: false, error: '删除订单失败' },
      { status: 500 }
    );
  }
}
