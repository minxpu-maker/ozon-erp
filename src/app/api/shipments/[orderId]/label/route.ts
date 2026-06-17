import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { ozonOrders, purchaseRecords, purchaseDemands, shipmentRecords, shops } from '@/storage/database/shared/schema';
import { eq } from 'drizzle-orm';
import { ozonRequest } from '@/lib/ozon-client';

interface LabelRequest {
  shipmentId?: number;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;
    const body: LabelRequest = await request.json();
    const orderIdNum = parseInt(orderId);

    if (isNaN(orderIdNum)) {
      return NextResponse.json(
        { success: false, error: '无效的订单ID' },
        { status: 400 }
      );
    }

    // 【业务验证1】验证订单存在
    const orderResult = await db
      .select()
      .from(ozonOrders)
      .where(eq(ozonOrders.id, orderIdNum))
      .limit(1);

    if (orderResult.length === 0) {
      return NextResponse.json(
        { success: false, error: '订单不存在' },
        { status: 404 }
      );
    }

    const order = orderResult[0];

    // 【业务验证2】验证采购记录状态必须是 'verified'
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
        { success: false, error: `订单当前状态为 '${purchaseRecord.status}'，必须验货通过后才能获取面单` },
        { status: 400 }
      );
    }

    // 【业务验证3】检查 shipment_records 是否存在
    const shipmentQuery = body.shipmentId
      ? db.select().from(shipmentRecords).where(eq(shipmentRecords.id, body.shipmentId)).limit(1)
      : db.select().from(shipmentRecords).where(eq(shipmentRecords.orderId, orderIdNum)).limit(1);

    const shipmentResult = await shipmentQuery;

    if (shipmentResult.length === 0) {
      return NextResponse.json(
        { success: false, error: '请先完成称重' },
        { status: 400 }
      );
    }

    const shipment = shipmentResult[0];

    // 【业务验证4】检查状态：必须先称重才能获取面单
    if (shipment.status === 'shipped') {
      return NextResponse.json(
        { success: false, error: '订单已发货，不能重复获取面单' },
        { status: 400 }
      );
    }

    // 获取店铺信息
    const shopResult = await db
      .select()
      .from(shops)
      .where(eq(shops.id, shipment.shopId))
      .limit(1);

    if (shopResult.length === 0) {
      return NextResponse.json(
        { success: false, error: '未找到店铺配置' },
        { status: 404 }
      );
    }

    const shop = shopResult[0];
    const clientId = shop.client_id || '';
    const apiKey = shop.api_key || '';

    if (!clientId || !apiKey) {
      return NextResponse.json(
        { success: false, error: '店铺未配置Ozon API凭证' },
        { status: 400 }
      );
    }

    // 调用 Ozon API 获取面单
    const ozonResponse = await ozonRequest(
      'POST',
      '/v2/posting/fbs/package-label/create',
      { posting_number: order.ozonPostingNumber },
      apiKey,
      clientId
    );

    if (!ozonResponse.ok) {
      console.error('[Label] Ozon API error:', ozonResponse.error);
      return NextResponse.json(
        {
          success: false,
          error: ozonResponse.error || '获取面单失败',
        },
        { status: 502 }
      );
    }

    const ozonData = ozonResponse.data as { result?: string[] };
    const base64Pdf = ozonData?.result?.[0];
    if (!base64Pdf) {
      return NextResponse.json(
        { success: false, error: 'Ozon未返回面单数据' },
        { status: 502 }
      );
    }

    // 【事务保证】Ozon API 成功后才更新状态
    await db.transaction(async (tx) => {
      // 更新 shipment 状态为 'labeled'
      await tx
        .update(shipmentRecords)
        .set({
          status: 'labeled',
          updatedAt: new Date(),
        })
        .where(eq(shipmentRecords.id, shipment.id));
    });

    return NextResponse.json({
      success: true,
      data: {
        shipmentId: shipment.id,
        orderId: orderIdNum,
        postingNumber: order.ozonPostingNumber,
        labelBase64: base64Pdf,
        message: '面单获取成功，请在浏览器中打印',
      },
    });
  } catch (error) {
    console.error('[Label] Error:', error);
    return NextResponse.json(
      { success: false, error: '获取面单失败' },
      { status: 500 }
    );
  }
}
