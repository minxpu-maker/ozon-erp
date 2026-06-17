import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { ozonOrders, purchaseRecords, purchaseDemands, shipmentRecords, shops, orderFinance } from '@/storage/database/shared/schema';
import { eq, inArray } from 'drizzle-orm';
import { ozonRequest } from '@/lib/ozon-client';

interface BatchRequest {
  action: 'print-labels' | 'confirm-ship';
  orderIds: number[];
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

    // 【业务验证】查询所有订单及其采购记录状态
    const ordersResult = await db
      .select({
        order: ozonOrders,
        shop: shops,
        purchaseStatus: purchaseRecords.status,
      })
      .from(ozonOrders)
      .innerJoin(purchaseDemands, eq(ozonOrders.id, purchaseDemands.orderId))
      .innerJoin(purchaseRecords, eq(purchaseDemands.id, purchaseRecords.demandId))
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
      return handleBatchConfirmShip(ordersResult, shipmentMap);
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
 * 流程：先验证前置条件 → 再批量获取面单 → 最后更新状态
 */
async function handleBatchPrintLabels(
  ordersResult: Array<{
    order: typeof ozonOrders.$inferSelect;
    shop: typeof shops.$inferSelect | null;
    purchaseStatus: string | null;
  }>,
  shipmentMap: Map<number, typeof shipmentRecords.$inferSelect>
) {
  const results: Array<{
    orderId: number;
    success: boolean;
    error?: string;
    pdfBase64?: string;
    postingNumber?: string;
  }> = [];

  // 【第一阶段】前置条件验证
  const validatedItems: Array<{
    item: typeof ordersResult[0];
    orderId: number;
    shipment: typeof shipmentRecords.$inferSelect;
  }> = [];

  for (const item of ordersResult) {
    const orderId = Number(item.order.id);

    // 验证采购记录状态
    if (item.purchaseStatus !== 'verified') {
      results.push({
        orderId,
        success: false,
        error: `订单状态为 '${item.purchaseStatus}'，必须验货通过后才能获取面单`,
      });
      continue;
    }

    // 验证称重记录
    const shipment = shipmentMap.get(orderId);
    if (!shipment) {
      results.push({ orderId, success: false, error: '请先完成称重' });
      continue;
    }

    // 验证状态：不能重复发货
    if (shipment.status === 'shipped') {
      results.push({ orderId, success: false, error: '订单已发货' });
      continue;
    }

    // 验证店铺凭证
    const shop = item.shop;
    if (!shop?.client_id || !shop?.api_key) {
      results.push({ orderId, success: false, error: '店铺未配置Ozon API凭证' });
      continue;
    }

    // 验证 posting_number
    if (!item.order.ozonPostingNumber) {
      results.push({ orderId, success: false, error: '缺少订单号' });
      continue;
    }

    validatedItems.push({ item, orderId, shipment });
  }

  // 【第二阶段】按店铺批量获取面单
  const byShop = new Map<string, typeof validatedItems>();
  for (const validated of validatedItems) {
    const shopId = validated.item.shop?.id || '';
    if (!byShop.has(shopId)) {
      byShop.set(shopId, []);
    }
    byShop.get(shopId)!.push(validated);
  }

  for (const [, shopItems] of byShop) {
    const shop = shopItems[0].item.shop;
    if (!shop?.client_id || !shop?.api_key) continue;

    // 批量获取面单
    const postingNumbers = shopItems
      .map((v) => v.item.order.ozonPostingNumber)
      .filter((p): p is string => !!p);

    if (postingNumbers.length === 0) continue;

    try {
      const ozonResponse = await ozonRequest(
        'POST',
        '/v2/posting/fbs/package-label/create',
        { posting_number: postingNumbers },
        shop.api_key,
        shop.client_id
      );

      if (ozonResponse.ok && ozonResponse.data) {
        const ozonData = ozonResponse.data as { result?: string[] };
        const labels = ozonData?.result || [];

        for (let i = 0; i < shopItems.length; i++) {
          const validated = shopItems[i];
          const label = labels[i];

          if (label) {
            // 更新状态
            await db.transaction(async (tx) => {
              await tx
                .update(shipmentRecords)
                .set({
                  status: 'labeled',
                  updatedAt: new Date(),
                })
                .where(eq(shipmentRecords.id, validated.shipment.id));
            });

            results.push({
              orderId: validated.orderId,
              success: true,
              pdfBase64: label,
              postingNumber: validated.item.order.ozonPostingNumber || undefined,
            });
          } else {
            results.push({
              orderId: validated.orderId,
              success: false,
              error: 'Ozon未返回面单数据',
            });
          }
        }
      } else {
        // API调用失败，所有该店铺的订单标记失败
        for (const validated of shopItems) {
          results.push({
            orderId: validated.orderId,
            success: false,
            error: ozonResponse.error || '获取面单失败',
          });
        }
      }
    } catch (error) {
      for (const validated of shopItems) {
        results.push({
          orderId: validated.orderId,
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
  ordersResult: Array<{
    order: typeof ozonOrders.$inferSelect;
    shop: typeof shops.$inferSelect | null;
    purchaseStatus: string | null;
  }>,
  shipmentMap: Map<number, typeof shipmentRecords.$inferSelect>
) {
  const results: Array<{
    orderId: number;
    success: boolean;
    error?: string;
    postingNumber?: string;
  }> = [];

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

    for (const item of items) {
      const orderId = Number(item.order.id);
      const postingNumber = item.order.ozonPostingNumber;

      // 【业务验证1】检查采购记录状态
      if (item.purchaseStatus !== 'verified') {
        results.push({
          orderId,
          success: false,
          error: `订单状态为 '${item.purchaseStatus}'，必须验货通过后才能发货`,
        });
        continue;
      }

      const shipment = shipmentMap.get(orderId);
      if (!shipment) {
        results.push({ orderId, success: false, error: '请先完成称重' });
        continue;
      }

      // 【业务验证2】检查状态：必须先获取面单才能发货
      if (shipment.status === 'shipped') {
        results.push({ orderId, success: false, error: '已发货' });
        continue;
      }

      if (shipment.status !== 'labeled') {
        results.push({ orderId, success: false, error: '必须先获取面单才能发货' });
        continue;
      }

      if (!postingNumber) {
        results.push({ orderId, success: false, error: '缺少posting_number' });
        continue;
      }

      // 3次重试
      let success = false;
      let lastError = '';

      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const ozonResponse = await ozonRequest(
            'POST',
            '/v3/posting/fbs/ship',
            { posting_number: postingNumber },
            shop.api_key,
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
        // 【事务保证】更新状态
        await db.transaction(async (tx) => {
          await tx
            .update(shipmentRecords)
            .set({
              status: 'shipped',
              shipTime: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(shipmentRecords.id, shipment.id));

          // 更新财务状态
          const financeResult = await tx
            .select()
            .from(orderFinance)
            .where(eq(orderFinance.orderId, orderId))
            .limit(1);

          if (financeResult.length > 0) {
            await tx
              .update(orderFinance)
              .set({
                status: 'pending',
                updatedAt: new Date(),
              })
              .where(eq(orderFinance.id, financeResult[0].id));
          }
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
