import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { ozonOrders, shipmentRecords, shops, orderFinance } from '@/storage/database/shared/schema';
import { eq } from 'drizzle-orm';
import { decrypt } from '@/lib/crypto';
import { ozonRequest } from '@/lib/ozon-client';

interface ConfirmRequest {
  shippingProvider?: string; // 物流商
  trackingNumber?: string; // 追踪号
}

interface ShipResult {
  success: boolean;
  shipmentId: number;
  ozonResponse?: Record<string, unknown>;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;
    const body: ConfirmRequest = await request.json();

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

    if (shipment[0].status === 'shipped') {
      return NextResponse.json(
        { success: false, error: '订单已发货' },
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

    const postingNumber = order.ozonPostingNumber;
    if (!postingNumber) {
      return NextResponse.json(
        { success: false, error: '缺少posting_number' },
        { status: 400 }
      );
    }

    // 调用 Ozon 发货确认 API（含3次重试）
    const shipResult = await shipWithRetry(
      postingNumber,
      apiKey,
      shop.client_id,
      body.shippingProvider,
      body.trackingNumber
    );

    if (!shipResult.success) {
      return NextResponse.json(
        { success: false, error: '发货确认失败，请重试' },
        { status: 502 }
      );
    }

    // 事务：更新状态 + 触发财务核算
    const result = await db.transaction(async (tx) => {
      // 1. 更新 shipment_records 状态
      await tx
        .update(shipmentRecords)
        .set({
          status: 'shipped',
          shipTime: new Date(),
          shippingMethod: body.shippingProvider || null,
          ozonTrackingNumber: body.trackingNumber || null,
          updatedAt: new Date(),
        })
        .where(eq(shipmentRecords.id, shipment[0].id));

      // 2. 预留：触发财务核算（待实现 calculateFinance）
      // await calculateFinance(orderIdNum);

      return { success: true };
    });

    return NextResponse.json({
      success: true,
      data: {
        shipmentId: shipment[0].id,
        ozonResponse: shipResult.ozonResponse,
        status: 'shipped',
      },
      message: '发货确认成功',
    });
  } catch (error) {
    console.error('[Shipments] Confirm error:', error);
    return NextResponse.json(
      { success: false, error: '发货确认失败' },
      { status: 500 }
    );
  }
}

/**
 * 调用 Ozon 发货确认 API，3次重试机制
 */
async function shipWithRetry(
  postingNumber: string,
  apiKey: string,
  clientId: string,
  shippingProvider?: string,
  trackingNumber?: string,
  maxRetries = 3
): Promise<ShipResult> {
  let lastError: string = '';

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Shipments] 尝试发货确认 (${attempt}/${maxRetries}): ${postingNumber}`);

      // Ozon 发货确认请求体
      const requestBody: Record<string, unknown> = {
        posting_number: postingNumber,
      };

      // 如果提供了物流信息，添加到请求中
      if (shippingProvider || trackingNumber) {
        requestBody.shipping_provider = shippingProvider;
        requestBody.tracking_number = trackingNumber;
      }

      const ozonResponse = await ozonRequest(
        'POST',
        '/v3/posting/fbs/ship',
        requestBody,
        apiKey,
        clientId
      );

      if (ozonResponse.ok) {
        console.log(`[Shipments] 发货确认成功: ${postingNumber}`);
        return {
          success: true,
          shipmentId: 0,
          ozonResponse: ozonResponse.data as Record<string, unknown>,
        };
      }

      lastError = ozonResponse.error || '未知错误';
      console.warn(`[Shipments] 发货确认失败 (${attempt}/${maxRetries}):`, lastError);

      // 如果还有重试次数，等待后重试
      if (attempt < maxRetries) {
        await sleep(1000 * attempt); // 递增等待时间
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : '网络错误';
      console.error(`[Shipments] 发货确认异常 (${attempt}/${maxRetries}):`, error);

      if (attempt < maxRetries) {
        await sleep(1000 * attempt);
      }
    }
  }

  console.error(`[Shipments] 发货确认最终失败 (${maxRetries}次):`, lastError);
  return { success: false, shipmentId: 0 };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
