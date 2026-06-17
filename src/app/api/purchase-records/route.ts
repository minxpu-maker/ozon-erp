import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { purchaseRecords, purchaseDemands, ozonOrders } from '@/storage/database/shared/schema';
import { eq, and, inArray, sql } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const shopId = searchParams.get('shopId');
    const domesticTrackingNo = searchParams.get('domesticTrackingNo');
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    // 构建查询条件
    const conditions = [];
    
    if (status) {
      conditions.push(eq(purchaseRecords.status, status));
    }
    
    if (shopId) {
      conditions.push(eq(purchaseRecords.shopId, shopId));
    }
    
    if (domesticTrackingNo) {
      conditions.push(eq(purchaseRecords.domesticTrackingNo, domesticTrackingNo));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const results = await db
      .select({
        id: purchaseRecords.id,
        demandId: purchaseRecords.demandId,
        shopId: purchaseRecords.shopId,
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
        orderedAt: purchaseRecords.orderedAt,
        createdAt: purchaseRecords.createdAt,
        updatedAt: purchaseRecords.updatedAt,
        // 关联的需求信息
        demandSku: purchaseDemands.sku,
        demandProductName: purchaseDemands.productName,
        demandQuantity: purchaseDemands.quantity,
        // 关联的订单信息
        ozonOrderId: ozonOrders.ozonOrderId,
        ozonPostingNumber: ozonOrders.ozonPostingNumber,
        orderStatus: ozonOrders.orderStatus,
        orderAmount: ozonOrders.orderAmount,
        shipmentDeadline: ozonOrders.shipmentDeadline,
      })
      .from(purchaseRecords)
      .leftJoin(purchaseDemands, eq(purchaseDemands.id, purchaseRecords.demandId))
      .leftJoin(ozonOrders, eq(ozonOrders.id, purchaseDemands.orderId))
      .where(whereClause)
      .orderBy(sql`${purchaseRecords.orderedAt} DESC NULLS LAST`)
      .limit(limit)
      .offset(offset);

    return NextResponse.json({
      success: true,
      data: results.map(r => ({
        ...r,
        purchasePrice: r.purchasePrice ? Number(r.purchasePrice) : null,
        totalPurchaseCost: r.totalPurchaseCost ? Number(r.totalPurchaseCost) : null,
        shippingFee: r.shippingFee ? Number(r.shippingFee) : null,
        orderAmount: r.orderAmount ? Number(r.orderAmount) : null,
      })),
      offset,
      limit,
    });
  } catch (error) {
    console.error('Error fetching purchase records:', error);
    return NextResponse.json(
      { success: false, error: '获取采购记录列表失败' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      demandId,
      supplierSource,
      purchasePrice,
      domesticTrackingNo,
      supplierName,
      sourceUrl,
      shippingFee = 0,
      purchaseQty = 1,
      purchaserId,
      boundBy,
      remark,
    } = body;

    // 必填校验
    if (!demandId) {
      return NextResponse.json(
        { success: false, error: 'demandId是必填字段' },
        { status: 400 }
      );
    }
    if (!supplierSource) {
      return NextResponse.json(
        { success: false, error: 'supplierSource是必填字段' },
        { status: 400 }
      );
    }
    if (!purchasePrice) {
      return NextResponse.json(
        { success: false, error: 'purchasePrice是必填字段' },
        { status: 400 }
      );
    }

    // 获取需求信息
    const demandRecord = await db
      .select({
        id: purchaseDemands.id,
        orderId: purchaseDemands.orderId,
        sku: purchaseDemands.sku,
        status: purchaseDemands.status,
      })
      .from(purchaseDemands)
      .where(eq(purchaseDemands.id, demandId))
      .limit(1);

    const demand = demandRecord;
    if (demand.length === 0) {
      return NextResponse.json(
        { success: false, error: '采购需求不存在' },
        { status: 404 }
      );
    }

    if (demand[0].status === 'purchased') {
      return NextResponse.json(
        { success: false, error: '该采购需求已创建过采购记录' },
        { status: 400 }
      );
    }

    // 计算总价
    const totalPurchaseCost = Number(purchasePrice) * Number(purchaseQty) + Number(shippingFee);

    // 获取店铺ID（从订单关联）
    const order = await db
      .select({ shopId: ozonOrders.shopId })
      .from(ozonOrders)
      .where(eq(ozonOrders.id, demand[0].orderId))
      .limit(1);

    const shopId = order.length > 0 ? order[0].shopId : null;

    // 如果有快递号，获取对应的Ozon订单ID
    let ozonOrderIds: string[] = [];
    if (domesticTrackingNo) {
      ozonOrderIds = [demand[0].orderId.toString()];
    }

    // 创建采购记录
    const insertData: Record<string, unknown> = {
      demandId: Number(demandId),
      supplierSource,
      purchasePrice,
      totalPurchaseCost,
      status: 'ordered',
      orderedAt: new Date(),
    };
    
    // 可选字段
    if (shopId) insertData.shopId = shopId;
    if (ozonOrderIds.length > 0) insertData.ozonOrderIds = ozonOrderIds;
    if (supplierName) insertData.supplierName = supplierName;
    if (sourceUrl) insertData.sourceUrl = sourceUrl;
    if (purchaseQty) insertData.purchaseQty = purchaseQty;
    if (shippingFee) insertData.shippingFee = shippingFee;
    if (domesticTrackingNo) {
      insertData.domesticTrackingNo = domesticTrackingNo;
      insertData.domesticStatus = 'pending';
    }
    if (purchaserId) insertData.purchaserId = purchaserId;
    if (boundBy) insertData.boundBy = boundBy;
    if (remark) insertData.remark = remark;
    
    const [newRecord] = await db.insert(purchaseRecords).values(insertData as typeof purchaseRecords.$inferInsert).returning();

    // 更新采购需求状态
    await db.update(purchaseDemands)
      .set({ status: 'purchased', updatedAt: new Date() })
      .where(eq(purchaseDemands.id, demandId));

    return NextResponse.json({
      success: true,
      data: {
        ...newRecord,
        purchasePrice: Number(newRecord.purchasePrice),
        totalPurchaseCost: Number(newRecord.totalPurchaseCost),
        shippingFee: Number(newRecord.shippingFee),
      },
      message: '采购记录创建成功',
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating purchase record:', error);
    return NextResponse.json(
      { success: false, error: '创建采购记录失败' },
      { status: 500 }
    );
  }
}
