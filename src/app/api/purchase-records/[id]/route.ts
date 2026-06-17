import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { purchaseRecords, purchaseDemands, ozonOrders } from '@/storage/database/shared/schema';
import { eq } from "drizzle-orm";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const recordId = parseInt(id, 10);
    
    if (isNaN(recordId)) {
      return NextResponse.json(
        { success: false, error: '无效的记录ID' },
        { status: 400 }
      );
    }

    const result = await db
      .select({
        id: purchaseRecords.id,
        demandId: purchaseRecords.demandId,
        shopId: purchaseRecords.shopId,
        ozonOrderIds: purchaseRecords.ozonOrderIds,
        supplierName: purchaseRecords.supplierName,
        supplierSource: purchaseRecords.supplierSource,
        sourceUrl: purchaseRecords.sourceUrl,
        purchasePrice: purchaseRecords.purchasePrice,
        purchaseQty: purchaseRecords.purchaseQty,
        totalPurchaseCost: purchaseRecords.totalPurchaseCost,
        shippingFee: purchaseRecords.shippingFee,
        domesticTrackingNo: purchaseRecords.domesticTrackingNo,
        domesticCarrier: purchaseRecords.domesticCarrier,
        domesticStatus: purchaseRecords.domesticStatus,
        status: purchaseRecords.status,
        exceptionType: purchaseRecords.exceptionType,
        orderedAt: purchaseRecords.orderedAt,
        receivedAt: purchaseRecords.receivedAt,
        verifiedAt: purchaseRecords.verifiedAt,
        purchaserId: purchaseRecords.purchaserId,
        boundBy: purchaseRecords.boundBy,
        remark: purchaseRecords.remark,
        createdAt: purchaseRecords.createdAt,
        updatedAt: purchaseRecords.updatedAt,
        // 关联的需求信息
        demandSku: purchaseDemands.sku,
        demandProductName: purchaseDemands.productName,
        demandProductImage: purchaseDemands.productImage,
        demandQuantity: purchaseDemands.quantity,
        // 关联的订单信息
        ozonOrderId: ozonOrders.ozonOrderId,
        ozonPostingNumber: ozonOrders.ozonPostingNumber,
        orderStatus: ozonOrders.orderStatus,
        orderAmount: ozonOrders.orderAmount,
        shipmentDeadline: ozonOrders.shipmentDeadline,
        deliveryAddress: ozonOrders.deliveryAddress,
      })
      .from(purchaseRecords)
      .leftJoin(purchaseDemands, eq(purchaseDemands.id, purchaseRecords.demandId))
      .leftJoin(ozonOrders, eq(ozonOrders.id, purchaseDemands.orderId))
      .where(eq(purchaseRecords.id, recordId))
      .limit(1);

    if (result.length === 0) {
      return NextResponse.json(
        { success: false, error: '采购记录不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        ...result[0],
        purchasePrice: result[0].purchasePrice ? Number(result[0].purchasePrice) : null,
        totalPurchaseCost: result[0].totalPurchaseCost ? Number(result[0].totalPurchaseCost) : null,
        shippingFee: result[0].shippingFee ? Number(result[0].shippingFee) : null,
        orderAmount: result[0].orderAmount ? Number(result[0].orderAmount) : null,
      },
    });
  } catch (error) {
    console.error('Error fetching purchase record:', error);
    return NextResponse.json(
      { success: false, error: '获取采购记录详情失败' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const recordId = parseInt(id, 10);
    
    if (isNaN(recordId)) {
      return NextResponse.json(
        { success: false, error: '无效的记录ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      supplierName,
      supplierSource,
      sourceUrl,
      purchasePrice,
      purchaseQty,
      shippingFee,
      domesticTrackingNo,
      domesticCarrier,
      purchaserId,
      boundBy,
      remark,
    } = body;

    // 检查记录是否存在
    const existing = await db
      .select()
      .from(purchaseRecords)
      .where(eq(purchaseRecords.id, recordId))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json(
        { success: false, error: '采购记录不存在' },
        { status: 404 }
      );
    }

    // 重新计算总价
    const newPurchasePrice = purchasePrice ?? Number(existing[0].purchasePrice);
    const newPurchaseQty = purchaseQty ?? Number(existing[0].purchaseQty);
    const newShippingFee = shippingFee ?? Number(existing[0].shippingFee);
    const totalPurchaseCost = newPurchasePrice * newPurchaseQty + newShippingFee;

    // 更新记录
    await db.update(purchaseRecords)
      .set({
        ...(supplierName !== undefined && { supplierName }),
        ...(supplierSource !== undefined && { supplierSource }),
        ...(sourceUrl !== undefined && { sourceUrl }),
        ...(purchasePrice !== undefined && { purchasePrice }),
        ...(purchaseQty !== undefined && { purchaseQty }),
        ...(shippingFee !== undefined && { shippingFee }),
        totalPurchaseCost,
        ...(domesticTrackingNo !== undefined && { domesticTrackingNo }),
        ...(domesticCarrier !== undefined && { domesticCarrier }),
        ...(purchaserId !== undefined && { purchaserId }),
        ...(boundBy !== undefined && { boundBy }),
        ...(remark !== undefined && { remark }),
        updatedAt: new Date(),
      })
      .where(eq(purchaseRecords.id, recordId));

    return NextResponse.json({
      success: true,
      message: '采购记录更新成功',
    });
  } catch (error) {
    console.error('Error updating purchase record:', error);
    return NextResponse.json(
      { success: false, error: '更新采购记录失败' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const recordId = parseInt(id, 10);
    
    if (isNaN(recordId)) {
      return NextResponse.json(
        { success: false, error: '无效的记录ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { domesticStatus, status, exceptionType } = body;

    // 检查记录是否存在
    const existing = await db
      .select()
      .from(purchaseRecords)
      .where(eq(purchaseRecords.id, recordId))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json(
        { success: false, error: '采购记录不存在' },
        { status: 404 }
      );
    }

    // 验证状态值
    const validDomesticStatuses = ['pending', 'shipped', 'received'];
    const validStatuses = ['ordered', 'shipped', 'received', 'verified', 'exception'];
    const validExceptionTypes = ['wrong_item', 'wrong_qty', 'quality', 'wrong_spec', 'damaged'];

    if (domesticStatus && !validDomesticStatuses.includes(domesticStatus)) {
      return NextResponse.json(
        { success: false, error: '无效的domesticStatus值' },
        { status: 400 }
      );
    }
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, error: '无效的status值' },
        { status: 400 }
      );
    }
    if (exceptionType && !validExceptionTypes.includes(exceptionType)) {
      return NextResponse.json(
        { success: false, error: '无效的exceptionType值' },
        { status: 400 }
      );
    }

    // 构建更新对象
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    
    if (domesticStatus) {
      updates.domesticStatus = domesticStatus;
      // 自动设置时间戳
      if (domesticStatus === 'shipped') {
        // shipped无需额外时间戳
      } else if (domesticStatus === 'received') {
        updates.receivedAt = new Date();
      }
    }
    
    if (status) {
      updates.status = status;
      if (status === 'exception') {
        updates.exceptionType = exceptionType || null;
      }
      if (status === 'verified') {
        updates.verifiedAt = new Date();
      }
    }

    await db.update(purchaseRecords)
      .set(updates)
      .where(eq(purchaseRecords.id, recordId));

    return NextResponse.json({
      success: true,
      message: '采购记录状态更新成功',
    });
  } catch (error) {
    console.error('Error patching purchase record:', error);
    return NextResponse.json(
      { success: false, error: '更新采购记录状态失败' },
      { status: 500 }
    );
  }
}
