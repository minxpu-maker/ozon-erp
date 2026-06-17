import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { shipmentRecords } from '@/storage/database/shared/fulfillment';
import { orders } from '@/storage/database/shared/schema';
import { eq } from 'drizzle-orm';

interface WeightRequest {
  totalWeight: number;
  weightSource: 'scale' | 'manual';
  packingMaterial?: string;
  packingCost?: number;
}

// 获取运费费率（默认0.5 USD/kg）
function getShippingRatePerKg(): number {
  return parseFloat(process.env.SHIPPING_RATE_PER_KG || '0.5');
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;
    const body: WeightRequest = await request.json();

    // 参数验证
    if (!body.totalWeight || body.totalWeight <= 0) {
      return NextResponse.json(
        { success: false, error: '重量必须大于0' },
        { status: 400 }
      );
    }

    if (!['scale', 'manual'].includes(body.weightSource)) {
      return NextResponse.json(
        { success: false, error: 'weightSource必须是scale或manual' },
        { status: 400 }
      );
    }

    // 【业务验证1】验证订单存在
    const orderResult = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (orderResult.length === 0) {
      return NextResponse.json(
        { success: false, error: '订单不存在' },
        { status: 404 }
      );
    }

    const order = orderResult[0];

    // 【业务验证2】验证订单必须已验货通过才能发货
    if (!order.isInspected) {
      return NextResponse.json(
        { success: false, error: '订单未验货通过，不能发货' },
        { status: 400 }
      );
    }

    // 【业务验证3】检查是否已经发货，不能重复称重
    const existingShipmentCheck = await db
      .select()
      .from(shipmentRecords)
      .where(eq(shipmentRecords.orderId, orderId))
      .limit(1);

    if (existingShipmentCheck.length > 0 && existingShipmentCheck[0].trackingNumber) {
      return NextResponse.json(
        { success: false, error: '订单已发货，不能重复称重' },
        { status: 400 }
      );
    }

    const shippingRatePerKg = getShippingRatePerKg();
    const estimatedShippingCost = parseFloat(
      (body.totalWeight * shippingRatePerKg).toFixed(2)
    );

    // 使用事务：写入 shipment_records
    const result = await db.transaction(async (tx) => {
      // 检查是否已有 shipment_records
      const existingShipment = await tx
        .select()
        .from(shipmentRecords)
        .where(eq(shipmentRecords.orderId, orderId))
        .limit(1);

      let shipmentId: string;
      if (existingShipment.length > 0) {
        const currentShipment = existingShipment[0];
        // 已发货状态不能更新
        if (currentShipment.trackingNumber) {
          throw new Error('订单已发货，不能重复称重');
        }
        // 更新
        await tx
          .update(shipmentRecords)
          .set({
            packageWeight: String(body.totalWeight),
            updatedAt: new Date(),
          })
          .where(eq(shipmentRecords.id, currentShipment.id));
        shipmentId = currentShipment.id;
      } else {
        // 新增
        const insertResult = await tx
          .insert(shipmentRecords)
          .values({
            orderId: orderId,
            shopId: order.shopId,
            packageWeight: String(body.totalWeight),
          })
          .returning({ id: shipmentRecords.id });
        shipmentId = insertResult[0].id;
      }

      return { shipmentId };
    });

    return NextResponse.json({
      success: true,
      data: {
        shipmentId: result.shipmentId,
        weight: body.totalWeight,
        weightSource: body.weightSource,
        estimatedShippingCost,
        message: '称重记录成功',
      },
      message: '称重记录成功',
    });
  } catch (error) {
    console.error('[Shipments] Weight error:', error);
    return NextResponse.json(
      { success: false, error: '称重记录失败，事务已回滚' },
      { status: 500 }
    );
  }
}
