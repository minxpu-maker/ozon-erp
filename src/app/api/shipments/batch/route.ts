import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { ozonOrders, shipmentRecords, shops } from '@/storage/database/shared/schema';
import { eq, inArray } from 'drizzle-orm';
import { decrypt } from '@/lib/crypto';
import { ozonRequest } from '@/lib/ozon-client';

interface BatchRequest {
  action: 'print-labels' | 'confirm-ship';
  orderIds: number[];
  shippingProvider?: string;
  trackingNumbers?: { orderId: number; trackingNumber: string }[];
}

export async function POST(request: NextRequest) {
  try {
    const body: BatchRequest = await request.json();

    // 参数验证
    if (!body.action || !['print-labels', 'confirm-ship'].includes(body.action)) {
      return NextResponse.json(
        { success: false, error: 'action必须是print-labels或confirm-ship' },
        { status: 400 }
      );
    }

    if (!Array.isArray(body.orderIds) || body.orderIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'orderIds不能为空' },
        { status: 400 }
      );
    }

    // 查询所有订单
    const ordersResult = await db
      .select({
        order: ozonOrders,
        shop: shops,
      })
      .from(ozonOrders)
      .leftJoin(shops, eq(ozonOrders.shopId, shops.id))
      .where(inArray(ozonOrders.id, body.orderIds));

    if (ordersResult.length === 0) {
      return NextResponse.json(
        { success: false, error: '未找到订单' },
        { status: 404 }
      );
    }

    // 查询所有 shipment_records
    const shipmentList = await db
      .select()
      .from(shipmentRecords)
      .where(inArray(shipmentRecords.orderId, body.orderIds));

    const shipmentMap = new Map(
      shipmentList.map((s) => [s.orderId, s])
    );

    // 按 action 分支处理
    if (body.action === 'print-labels') {
      return handleBatchPrintLabels(ordersResult, shipmentMap);
    } else {
      return handleBatchConfirmShip(
        ordersResult,
        shipmentMap,
        body.shippingProvider,
        body.trackingNumbers
      );
    }
  } catch (error) {
    console.error('[Shipments] Batch error:', error);
    return NextResponse.json(
      { success: false, error: '批量操作失败' },
      { status: 500 }
    );
  }
}

/**
 * 批量打印面单
 */
async function handleBatchPrintLabels(
  ordersResult: Array<{ order: typeof ozonOrders.$inferSelect; shop: typeof shops.$inferSelect | null }>,
  shipmentMap: Map<number, typeof shipmentRecords.$inferSelect>
) {
  const results: Array<{
    orderId: number;
    success: boolean;
    error?: string;
    pdfBase64?: string;
    postingNumber?: string;
  }> = [];

  // 按店铺分组请求（同一店铺的请求可以批量）
  const byShop = new Map<string, typeof ordersResult>();
  for (const item of ordersResult) {
    const shopId = item.shop?.id || '';
    if (!byShop.has(shopId)) {
      byShop.set(shopId, []);
    }
    byShop.get(shopId)!.push(item);
  }

  for (const [, items] of byShop) {
    const shop = items[0].shop;
    if (!shop?.client_id || !shop?.api_key) continue;

    let apiKey: string;
    try {
      apiKey = decrypt(shop.api_key);
    } catch {
      for (const item of items) {
        results.push({ orderId: Number(item.order.id), success: false, error: 'API密钥解密失败' });
      }
      continue;
    }

    // 批量获取面单
    const postingNumbers = items
      .map((i) => i.order.ozonPostingNumber)
      .filter((p): p is string => !!p);

    if (postingNumbers.length === 0) continue;

    try {
      const ozonResponse = await ozonRequest(
        'POST',
        '/v2/posting/fbs/package-label/create',
        { posting_number: postingNumbers, with_barcode: true },
        apiKey,
        shop.client_id
      );

      if (ozonResponse.ok && ozonResponse.data) {
        const ozonData = ozonResponse.data as { content?: string };
        for (const item of items) {
          results.push({
            orderId: Number(item.order.id),
            success: true,
            pdfBase64: ozonData.content || undefined,
            postingNumber: item.order.ozonPostingNumber || undefined,
          });

          // 更新状态
          const shipment = shipmentMap.get(Number(item.order.id));
          if (shipment) {
            await db
              .update(shipmentRecords)
              .set({ status: 'labeled', updatedAt: new Date() })
              .where(eq(shipmentRecords.id, shipment.id));
          }
        }
      } else {
        for (const item of items) {
          results.push({
            orderId: Number(item.order.id),
            success: false,
            error: ozonResponse.error || '获取面单失败',
          });
        }
      }
    } catch (error) {
      for (const item of items) {
        results.push({
          orderId: Number(item.order.id),
          success: false,
          error: error instanceof Error ? error.message : '网络错误',
        });
      }
    }
  }

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  return NextResponse.json({
    success: true,
    data: {
      results,
      summary: {
        total: results.length,
        success: successCount,
        failed: failCount,
      },
    },
    message: `批量打印完成: ${successCount}成功, ${failCount}失败`,
  });
}

/**
 * 批量发货确认
 */
async function handleBatchConfirmShip(
  ordersResult: Array<{ order: typeof ozonOrders.$inferSelect; shop: typeof shops.$inferSelect | null }>,
  shipmentMap: Map<number, typeof shipmentRecords.$inferSelect>,
  shippingProvider?: string,
  trackingNumbers?: Array<{ orderId: number; trackingNumber: string }>
) {
  const results: Array<{
    orderId: number;
    success: boolean;
    error?: string;
    postingNumber?: string;
  }> = [];

  const trackingMap = new Map(
    (trackingNumbers || []).map((t) => [t.orderId, t.trackingNumber])
  );

  // 按店铺分组
  const byShop = new Map<string, typeof ordersResult>();
  for (const item of ordersResult) {
    const shopId = item.shop?.id || '';
    if (!byShop.has(shopId)) {
      byShop.set(shopId, []);
    }
    byShop.get(shopId)!.push(item);
  }

  for (const [, items] of byShop) {
    const shop = items[0].shop;
    if (!shop?.client_id || !shop?.api_key) continue;

    let apiKey: string;
    try {
      apiKey = decrypt(shop.api_key);
    } catch {
      for (const item of items) {
        results.push({ orderId: Number(item.order.id), success: false, error: 'API密钥解密失败' });
      }
      continue;
    }

    for (const item of items) {
      const orderId = Number(item.order.id);
      const shipment = shipmentMap.get(orderId);
      if (!shipment) {
        results.push({ orderId, success: false, error: '请先完成称重' });
        continue;
      }

      if (shipment.status === 'shipped') {
        results.push({ orderId, success: false, error: '已发货' });
        continue;
      }

      const postingNumber = item.order.ozonPostingNumber;
      if (!postingNumber) {
        results.push({ orderId, success: false, error: '缺少posting_number' });
        continue;
      }

      const trackingNumber = trackingMap.get(orderId);

      // 3次重试
      let success = false;
      let lastError = '';

      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const requestBody: Record<string, unknown> = { posting_number: postingNumber };
          if (shippingProvider) requestBody.shipping_provider = shippingProvider;
          if (trackingNumber) requestBody.tracking_number = trackingNumber;

          const ozonResponse = await ozonRequest(
            'POST',
            '/v3/posting/fbs/ship',
            requestBody,
            apiKey,
            shop.client_id
          );

          if (ozonResponse.ok) {
            success = true;
            break;
          }
          lastError = ozonResponse.error || '未知错误';

          if (attempt < 3) {
            await sleep(1000 * attempt);
          }
        } catch (error) {
          lastError = error instanceof Error ? error.message : '网络错误';
          if (attempt < 3) {
            await sleep(1000 * attempt);
          }
        }
      }

      if (success) {
        // 更新状态
        await db.transaction(async (tx) => {
          await tx
            .update(shipmentRecords)
            .set({
              status: 'shipped',
              shipTime: new Date(),
              shippingMethod: shippingProvider || null,
              ozonTrackingNumber: trackingNumber || null,
              updatedAt: new Date(),
            })
            .where(eq(shipmentRecords.id, shipment.id));
        });

        results.push({
          orderId,
          success: true,
          postingNumber,
        });
      } else {
        results.push({
          orderId,
          success: false,
          error: lastError,
        });
      }
    }
  }

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  return NextResponse.json({
    success: true,
    data: {
      results,
      summary: {
        total: results.length,
        success: successCount,
        failed: failCount,
      },
    },
    message: `批量发货确认完成: ${successCount}成功, ${failCount}失败`,
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
