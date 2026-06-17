import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { ozonOrders, shipmentRecords, shops } from '@/storage/database/shared/schema';
import { eq } from 'drizzle-orm';
import { decrypt } from '@/lib/crypto';
import { ozonRequest } from '@/lib/ozon-client';

interface LabelRequest {
  postingNumber?: string; // 可选，指定要打印的posting number
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

    // 查询订单和店铺信息
    const orderResult = await db
      .select({
        order: ozonOrders,
        shop: shops,
      })
      .from(ozonOrders)
      .leftJoin(shops, eq(ozonOrders.shopId, shops.id))
      .where(eq(ozonOrders.id, orderIdNum))
      .limit(1);

    if (orderResult.length === 0) {
      return NextResponse.json(
        { success: false, error: '订单不存在' },
        { status: 404 }
      );
    }

    const { order, shop } = orderResult[0];
    if (!shop?.client_id || !shop?.api_key) {
      return NextResponse.json(
        { success: false, error: '店铺API配置不完整' },
        { status: 400 }
      );
    }

    // 获取 shipment_records
    const shipment = await db
      .select()
      .from(shipmentRecords)
      .where(eq(shipmentRecords.orderId, orderIdNum))
      .limit(1);

    if (shipment.length === 0) {
      return NextResponse.json(
        { success: false, error: '请先完成称重' },
        { status: 400 }
      );
    }

    // 解密 API Key
    let apiKey: string;
    try {
      apiKey = decrypt(shop.api_key);
    } catch {
      return NextResponse.json(
        { success: false, error: 'API密钥解密失败' },
        { status: 500 }
      );
    }

    // 获取 posting number
    const postingNumber = body.postingNumber || order.ozonPostingNumber;
    if (!postingNumber) {
      return NextResponse.json(
        { success: false, error: '缺少posting_number' },
        { status: 400 }
      );
    }

    // 调用 Ozon API 获取面单 PDF
    const ozonResponse = await ozonRequest(
      'POST',
      '/v2/posting/fbs/package-label/create',
      { posting_number: [postingNumber], with_barcode: true },
      apiKey,
      shop.client_id
    );

    if (!ozonResponse.ok) {
      console.error('[Shipments] Ozon label error:', ozonResponse.error);
      return NextResponse.json(
        { success: false, error: ozonResponse.error || '获取面单失败' },
        { status: 502 }
      );
    }

    const ozonData = ozonResponse.data as { content?: string };
    if (!ozonData?.content) {
      return NextResponse.json(
        { success: false, error: 'Ozon返回数据格式错误' },
        { status: 502 }
      );
    }

    // 更新 shipment 状态
    await db
      .update(shipmentRecords)
      .set({
        status: 'labeled',
        ozonTrackingNumber: postingNumber,
        updatedAt: new Date(),
      })
      .where(eq(shipmentRecords.id, shipment[0].id));

    return NextResponse.json({
      success: true,
      data: {
        pdfBase64: ozonData.content,
        postingNumber,
        shipmentId: shipment[0].id,
      },
      message: '面单获取成功',
    });
  } catch (error) {
    console.error('[Shipments] Label error:', error);
    return NextResponse.json(
      { success: false, error: '获取面单失败' },
      { status: 500 }
    );
  }
}
