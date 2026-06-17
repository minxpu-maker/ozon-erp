import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { ozonOrders, purchaseRecords, purchaseDemands, shipmentRecords, shops, orderFinance } from '@/storage/database/shared/schema';
import { eq } from 'drizzle-orm';
import { ozonRequest } from '@/lib/ozon-client';

// 最大重试次数
const MAX_RETRIES = 3;

interface ConfirmRequest {
  shipmentId?: number;
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
        { success: false, error: `订单当前状态为 '${purchaseRecord.status}'，必须验货通过后才能发货` },
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
        { success: false, error: '请先完成称重和获取面单' },
        { status: 400 }
      );
    }

    const shipment = shipmentResult[0];

    // 【业务验证4】检查状态：必须先获取面单才能发货
    if (shipment.status === 'shipped') {
      return NextResponse.json(
        { success: false, error: '订单已发货' },
        { status: 400 }
      );
    }

    if (shipment.status !== 'labeled') {
      return NextResponse.json(
        { success: false, error: '必须先获取面单才能确认发货' },
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
      // 更新 shipment 状态为 'shipped'
      await tx
        .update(shipmentRecords)
        .set({
          status: 'shipped',
          shipTime: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(shipmentRecords.id, shipment.id));

      // 更新 order_finance 状态为 'pending'（预留财务核算触发点）
      const financeResult = await tx
        .select()
        .from(orderFinance)
        .where(eq(orderFinance.orderId, orderIdNum))
        .limit(1);

      if (financeResult.length > 0) {
        await tx
          .update(orderFinance)
          .set({
            status: 'pending', // 待核算
            updatedAt: new Date(),
          })
          .where(eq(orderFinance.id, financeResult[0].id));
      }

      // 【预留】触发财务核算（当前阶段预留，未来集成）
      // TODO: calculateFinance(orderIdNum);
    });

    return NextResponse.json({
      success: true,
      data: {
        orderId: orderIdNum,
        postingNumber: order.ozonPostingNumber,
        shipmentId: shipment.id,
        shippedAt: new Date().toISOString(),
        retries: retryCount,
        financeTriggered: true,
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
