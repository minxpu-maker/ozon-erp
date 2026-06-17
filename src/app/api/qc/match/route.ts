import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { purchaseRecords, ozonOrders, purchaseDemands } from '@/storage/database/shared/fulfillment';
import { shops } from '@/storage/database/shared/schema';
import { eq, and } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const expressNo = searchParams.get('expressNo');

    if (!expressNo) {
      return NextResponse.json(
        { success: false, error: '请提供快递单号' },
        { status: 400 }
      );
    }

    // 扫码匹配查询 - 使用 domestic_tracking_no 索引 (B01已创建)
    const matchedRecords = await db
      .select({
        // purchase_records 字段
        id: purchaseRecords.id,
        supplierName: purchaseRecords.supplierName,
        supplierSource: purchaseRecords.supplierSource,
        purchasePrice: purchaseRecords.purchasePrice,
        purchaseQty: purchaseRecords.purchaseQty,
        totalPurchaseCost: purchaseRecords.totalPurchaseCost,
        status: purchaseRecords.status,
        verifiedAt: purchaseRecords.verifiedAt,
        // ozon_orders 字段
        orderId: ozonOrders.id,
        ozonOrderId: ozonOrders.ozonOrderId,
        ozonPostingNumber: ozonOrders.ozonPostingNumber,
        customerName: ozonOrders.customerName,
        deliveryAddress: ozonOrders.deliveryAddress,
        orderAmount: ozonOrders.orderAmount,
        orderStatus: ozonOrders.orderStatus,
        shipmentDeadline: ozonOrders.shipmentDeadline,
        orderTime: ozonOrders.orderTime,
        itemsJson: ozonOrders.itemsJson,
        // purchase_demands 字段
        sku: purchaseDemands.sku,
        productName: purchaseDemands.productName,
        productImage: purchaseDemands.productImage,
        quantity: purchaseDemands.quantity,
        // shops 字段
        shopName: shops.name,
      })
      .from(purchaseRecords)
      .leftJoin(
        purchaseDemands,
        eq(purchaseDemands.id, purchaseRecords.demandId)
      )
      .leftJoin(ozonOrders, eq(ozonOrders.id, purchaseDemands.orderId))
      .leftJoin(shops, eq(shops.id, purchaseRecords.shopId))
      .where(eq(purchaseRecords.domesticTrackingNo, expressNo));

    if (!matchedRecords || matchedRecords.length === 0) {
      return NextResponse.json(
        { success: false, matched: false, error: '未找到匹配的快递单号' },
        { status: 404 }
      );
    }

    // 第一个记录的主信息
    const firstRecord = matchedRecords[0];
    
    // 检查是否已验货
    const alreadyVerified = firstRecord.status === 'verified';
    
    // 聚合所有关联的订单
    const orders = matchedRecords
      .filter(r => r.orderId !== null)
      .map(r => ({
        orderId: r.orderId,
        ozonOrderId: r.ozonOrderId,
        ozonPostingNumber: r.ozonPostingNumber,
        customerName: r.customerName,
        deliveryAddress: r.deliveryAddress,
        orderAmount: r.orderAmount,
        orderStatus: r.orderStatus,
        shipmentDeadline: r.shipmentDeadline,
        orderTime: r.orderTime,
        itemsJson: r.itemsJson,
        sku: r.sku,
        productName: r.productName,
        productImage: r.productImage,
        quantity: r.quantity,
      }));

    return NextResponse.json({
      success: true,
      matched: true,
      alreadyVerified,
      purchaseRecord: {
        id: firstRecord.id,
        supplierName: firstRecord.supplierName,
        supplierSource: firstRecord.supplierSource,
        purchasePrice: firstRecord.purchasePrice,
        purchaseQty: firstRecord.purchaseQty,
        totalPurchaseCost: firstRecord.totalPurchaseCost,
        status: firstRecord.status,
        verifiedAt: firstRecord.verifiedAt,
      },
      shopName: firstRecord.shopName,
      orders,
    });
  } catch (error) {
    console.error('[QC Match] Error:', error);
    return NextResponse.json(
      { success: false, error: '查询失败' },
      { status: 500 }
    );
  }
}
