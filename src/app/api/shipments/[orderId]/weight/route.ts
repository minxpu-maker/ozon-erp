import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { ozonOrders, purchaseRecords, purchaseDemands, shipmentRecords, orderFinance } from '@/storage/database/shared/schema';
import { eq, and } from 'drizzle-orm';

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

    const orderIdNum = parseInt(orderId);
    if (isNaN(orderIdNum)) {
      return NextResponse.json(
        { success: false, error: '无效的订单ID' },
        { status: 400 }
      );
    }

    // 【业务验证1】验证订单存在
    const order = await db
      .select()
      .from(ozonOrders)
      .where(eq(ozonOrders.id, orderIdNum))
      .limit(1);

    if (order.length === 0) {
      return NextResponse.json(
        { success: false, error: '订单不存在' },
        { status: 404 }
      );
    }

    // 【业务验证2】验证采购记录状态必须是 'verified'（已验货）才能发货
    const purchaseRecordResult = await db
      .select()
      .from(ozonOrders)
      .innerJoin(purchaseDemands, eq(ozonOrders.id, purchaseDemands.orderId))
      .innerJoin(purchaseRecords, eq(purchaseDemands.id, purchaseRecords.demandId))
      .where(eq(ozonOrders.id, orderIdNum))
      .limit(1);

    if (purchaseRecordResult.length === 0) {
      return NextResponse.json(
        { success: false, error: '未找到采购记录' },
        { status: 404 }
      );
    }

    const purchaseRecord = purchaseRecordResult[0].purchase_records;
    if (purchaseRecord.status !== 'verified') {
      return NextResponse.json(
        { success: false, error: `订单当前状态为 '${purchaseRecord.status}'，必须验货通过后才能发货` },
        { status: 400 }
      );
    }

    // 【业务验证3】检查是否已经发货，不能重复称重
    const existingShipmentCheck = await db
      .select()
      .from(shipmentRecords)
      .where(eq(shipmentRecords.orderId, orderIdNum))
      .limit(1);

    if (existingShipmentCheck.length > 0 && existingShipmentCheck[0].status === 'shipped') {
      return NextResponse.json(
        { success: false, error: '订单已发货，不能重复称重' },
        { status: 400 }
      );
    }

    const shippingRatePerKg = getShippingRatePerKg();
    const estimatedShippingCost = parseFloat(
      (body.totalWeight * shippingRatePerKg).toFixed(2)
    );

    // 使用事务：必须同时写入 shipment_records 和 order_finance
    const result = await db.transaction(async (tx) => {
      // 1. 检查是否已有 shipment_records
      const existingShipment = await tx
        .select()
        .from(shipmentRecords)
        .where(eq(shipmentRecords.orderId, orderIdNum))
        .limit(1);

      let shipmentId: number;
      if (existingShipment.length > 0) {
        const currentShipment = existingShipment[0];
        // 已发货状态不能更新
        if (currentShipment.status === 'shipped') {
          throw new Error('订单已发货，不能重复称重');
        }
        // 更新
        await tx
          .update(shipmentRecords)
          .set({
            totalWeight: String(body.totalWeight),
            packingMaterial: body.packingMaterial || null,
            packingCost: String(body.packingCost || 0),
            status: 'packed',
            updatedAt: new Date(),
          })
          .where(eq(shipmentRecords.id, currentShipment.id));
        shipmentId = currentShipment.id;
      } else {
        // 新增
        const insertResult = await tx
          .insert(shipmentRecords)
          .values({
            orderId: orderIdNum,
            shopId: order[0].shopId,
            totalWeight: String(body.totalWeight),
            packingMaterial: body.packingMaterial || null,
            packingCost: String(body.packingCost || 0),
            status: 'packed',
          })
          .returning({ id: shipmentRecords.id });
        shipmentId = insertResult[0].id;
      }

      // 2. 同步写入 order_finance（F-013决策：必须成功）
      const existingFinance = await tx
        .select()
        .from(orderFinance)
        .where(eq(orderFinance.orderId, orderIdNum))
        .limit(1);

      if (existingFinance.length > 0) {
        // 更新
        await tx
          .update(orderFinance)
          .set({
            actualWeight: String(body.totalWeight),
            weightSource: body.weightSource,
            estimatedShippingCost: String(estimatedShippingCost),
            updatedAt: new Date(),
          })
          .where(eq(orderFinance.id, existingFinance[0].id));
      } else {
        // 新增
        await tx.insert(orderFinance).values({
          orderId: orderIdNum,
          shopId: order[0].shopId,
          actualWeight: String(body.totalWeight),
          weightSource: body.weightSource,
          estimatedShippingCost: String(estimatedShippingCost),
          status: 'estimated',
        });
      }

      return { shipmentId };
    });

    return NextResponse.json({
      success: true,
      data: {
        shipmentId: result.shipmentId,
        weight: body.totalWeight,
        weightSource: body.weightSource,
        packingMaterial: body.packingMaterial,
        packingCost: body.packingCost || 0,
        estimatedShippingCost,
        financeSynced: true,
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
