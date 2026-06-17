import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { ozonOrders, purchaseRecords, purchaseDemands, shipmentRecords, shops } from '@/storage/database/shared/schema';
import { eq, and, isNull, or, asc } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const offset = parseInt(searchParams.get('offset') || '0');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);

    // 查询待发货队列：
    // 条件：purchase_records.status='verified' 且无对应有效的 shipment_records
    const queueItems = await db
      .select({
        // ozon_orders 信息
        orderId: ozonOrders.id,
        ozonOrderId: ozonOrders.ozonOrderId,
        ozonPostingNumber: ozonOrders.ozonPostingNumber,
        erpStatus: ozonOrders.erpStatus,
        customerName: ozonOrders.customerName,
        deliveryAddress: ozonOrders.deliveryAddress,
        orderAmount: ozonOrders.orderAmount,
        shipmentDeadline: ozonOrders.shipmentDeadline,
        orderTime: ozonOrders.orderTime,
        itemsJson: ozonOrders.itemsJson,
        // purchase_records 信息
        purchaseRecordId: purchaseRecords.id,
        demandId: purchaseRecords.demandId,
        totalPurchaseCost: purchaseRecords.totalPurchaseCost,
        domesticTrackingNo: purchaseRecords.domesticTrackingNo,
        // purchase_demands 信息
        sku: purchaseDemands.sku,
        productName: purchaseDemands.productName,
        productImage: purchaseDemands.productImage,
        quantity: purchaseDemands.quantity,
        // shipment_records 信息 (如存在)
        shipmentId: shipmentRecords.id,
        shipmentStatus: shipmentRecords.status,
        totalWeight: shipmentRecords.totalWeight,
        ozonTrackingNumber: shipmentRecords.ozonTrackingNumber,
        shipTime: shipmentRecords.shipTime,
        // shop 信息
        shopId: shops.id,
        shopName: shops.name,
      })
      .from(ozonOrders)
      .innerJoin(purchaseRecords, eq(ozonOrders.id, purchaseRecords.demandId))
      .innerJoin(purchaseDemands, eq(purchaseRecords.demandId, purchaseDemands.id))
      .innerJoin(shops, eq(ozonOrders.shopId, shops.id))
      .leftJoin(
        shipmentRecords,
        and(
          eq(ozonOrders.id, shipmentRecords.orderId),
          eq(shipmentRecords.status, 'shipped')
        )
      )
      .where(
        and(
          eq(purchaseRecords.status, 'verified'),
          isNull(shipmentRecords.id)
        )
      )
      .orderBy(asc(ozonOrders.shipmentDeadline))
      .limit(limit)
      .offset(offset);

    // 统计总数
    const totalResult = await db
      .select({ count: ozonOrders.id })
      .from(ozonOrders)
      .innerJoin(purchaseRecords, eq(ozonOrders.id, purchaseRecords.demandId))
      .leftJoin(
        shipmentRecords,
        and(
          eq(ozonOrders.id, shipmentRecords.orderId),
          eq(shipmentRecords.status, 'shipped')
        )
      )
      .where(
        and(
          eq(purchaseRecords.status, 'verified'),
          isNull(shipmentRecords.id)
        )
      );

    const total = totalResult.length;

    // 计算当前步骤状态
    const result = queueItems.map((item) => {
      let step: 'pending_weight' | 'weighted' | 'printed' = 'pending_weight';
      if (item.totalWeight !== null) {
        step = 'weighted';
      }
      if (item.ozonTrackingNumber !== null) {
        step = 'printed';
      }

      return {
        orderId: item.orderId,
        ozonOrderId: item.ozonOrderId,
        ozonPostingNumber: item.ozonPostingNumber,
        customerName: item.customerName,
        deliveryAddress: item.deliveryAddress,
        orderAmount: item.orderAmount,
        shipmentDeadline: item.shipmentDeadline,
        sku: item.sku,
        productName: item.productName,
        productImage: item.productImage,
        quantity: item.quantity,
        domesticTrackingNo: item.domesticTrackingNo,
        purchaseCost: item.totalPurchaseCost,
        shopId: item.shopId,
        shopName: item.shopName,
        currentStep: step,
        shipmentId: item.shipmentId,
        totalWeight: item.totalWeight,
        ozonTrackingNumber: item.ozonTrackingNumber,
        shipTime: item.shipTime,
      };
    });

    return NextResponse.json({
      success: true,
      data: result,
      total,
      offset,
      limit,
    });
  } catch (error) {
    console.error('[Shipments] GET queue error:', error);
    return NextResponse.json(
      { success: false, error: '获取发货队列失败' },
      { status: 500 }
    );
  }
}
