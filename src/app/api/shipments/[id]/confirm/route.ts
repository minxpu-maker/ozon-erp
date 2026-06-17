import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { shipmentRecords } from '@/storage/database/shared/fulfillment';
import { orders, shops } from '@/storage/database/shared/schema';
import { eq } from 'drizzle-orm';
import { ozonRequest } from '@/lib/ozon-client';

// 最大重试次数
const MAX_RETRIES = 3;

interface ConfirmRequest {
  shipmentId?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body: ConfirmRequest = await request.json();

    // 【业务验证1】验证订单存在
    const orderResult = await db
      .select()
      .from(orders)
      .where(eq(orders.id, id))
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

    // 【业务验证3】检查 shipment_records 是否存在
    const shipmentQuery = body.shipmentId
      ? db.select().from(shipmentRecords).where(eq(shipmentRecords.id, body.shipmentId)).limit(1)
      : db.select().from(shipmentRecords).where(eq(shipmentRecords.orderId, id)).limit(1);

    const shipmentResult = await shipmentQuery;

    if (shipmentResult.length === 0) {
      return NextResponse.json(
        { success: false, error: '请先完成称重和获取面单' },
        { status: 400 }
      );
    }

    const shipment = shipmentResult[0];

    // 【业务验证4】检查状态：必须先获取面单才能发货
    if (shipment.trackingNumber) {
      return NextResponse.json(
        { success: false, error: '订单已发货' },
        { status: 400 }
      );
    }

    if (!shipment.labelUrl) {
      return NextResponse.json(
        { success: false, error: '必须先获取面单才能确认发货' },
        { status: 400 }
      );
    }

    // 获取店铺信息
    let clientId = '';
    let apiKey = '';
    
    if (shipment.shopId) {
      const shopResult = await db
        .select()
        .from(shops)
        .where(eq(shops.id, shipment.shopId))
        .limit(1);

      if (shopResult.length > 0) {
        const shop = shopResult[0];
        // 兼容不同的字段名
        clientId = (shop as { client_id?: string; ozonClientId?: string }).client_id 
          || (shop as { ozonClientId?: string }).ozonClientId || '';
        apiKey = (shop as { api_key?: string; ozonApiKey?: string }).api_key 
          || (shop as { ozonApiKey?: string }).ozonApiKey || '';
      }
    }

    if (!clientId || !apiKey) {
      return NextResponse.json(
        { success: false, error: '店铺未配置Ozon API凭证' },
        { status: 400 }
      );
    }

    // 调用 Ozon API 确认发货（3次重试）
    let lastError = '';
    let retryCount = 0;

    while (retryCount < MAX_RETRIES) {
      try {
        const ozonResponse = await ozonRequest(
          'POST',
          '/v3/posting/fbs/ship',
          {
            posting_number: order.ozonPostingNumber,
          },
          apiKey,
          clientId
        );

        if (ozonResponse.ok) {
          lastError = '';
          break;
        }

        lastError = ozonResponse.error || `Ozon API错误: ${ozonResponse.status}`;
        console.warn(`[Confirm] Ozon API retry ${retryCount + 1} failed:`, ozonResponse.error);
      } catch (err) {
        lastError = err instanceof Error ? err.message : '未知错误';
        console.warn(`[Confirm] Retry ${retryCount + 1} error:`, err);
      }

      retryCount++;

      if (retryCount < MAX_RETRIES) {
        // 指数退避: 1s, 2s, 4s
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, retryCount - 1) * 1000));
      }
    }

    if (lastError) {
      console.error('[Confirm] All retries failed:', lastError);
      return NextResponse.json(
        { success: false, error: `发货确认失败: ${lastError}` },
        { status: 502 }
      );
    }

    // 【事务保证】Ozon API 成功后才更新状态
    await db.transaction(async (tx) => {
      // 更新 shipment 记录发货时间
      await tx
        .update(shipmentRecords)
        .set({
          shippedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(shipmentRecords.id, shipment.id));

      // 更新订单状态为已发货
      await tx
        .update(orders)
        .set({
          erpStatus: 'shipped',
          shippedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(orders.id, id));
    });

    return NextResponse.json({
      success: true,
      data: {
        orderId: id,
        postingNumber: order.ozonPostingNumber,
        shipmentId: shipment.id,
        shippedAt: new Date().toISOString(),
        retries: retryCount,
      },
      message: '发货确认成功',
    });
  } catch (error) {
    console.error('[Confirm] Error:', error);
    return NextResponse.json(
      { success: false, error: '发货确认失败' },
      { status: 500 }
    );
  }
}
