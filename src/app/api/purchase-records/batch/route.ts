import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { purchaseRecords, purchaseDemands, ozonOrders, type InsertPurchaseRecord } from '@/storage/database/shared/fulfillment';
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { items } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'items是必填字段且必须是非空数组' },
        { status: 400 }
      );
    }

    const successRecords: Array<{ demandId: number; recordId: number }> = [];
    const failedItems: Array<{ demandId?: number; error: string; index: number }> = [];

    // 逐条验证
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      if (!item.demandId) {
        failedItems.push({ demandId: item.demandId, error: 'demandId是必填字段', index: i });
        continue;
      }
      if (!item.purchasePrice) {
        failedItems.push({ demandId: item.demandId, error: 'purchasePrice是必填字段', index: i });
        continue;
      }
      if (!item.supplierSource) {
        failedItems.push({ demandId: item.demandId, error: 'supplierSource是必填字段', index: i });
        continue;
      }

      // 检查需求是否存在且未采购
      const demand = await db
        .select({
          id: purchaseDemands.id,
          orderId: purchaseDemands.orderId,
          status: purchaseDemands.status,
        })
        .from(purchaseDemands)
        .where(eq(purchaseDemands.id, item.demandId))
        .limit(1);

      if (demand.length === 0) {
        failedItems.push({ demandId: item.demandId, error: '采购需求不存在', index: i });
        continue;
      }
      if (demand[0].status === 'purchased') {
        failedItems.push({ demandId: item.demandId, error: '该需求已采购', index: i });
        continue;
      }
    }

    // 如果有失败项且没有成功记录，直接返回失败
    if (failedItems.length > 0 && successRecords.length === 0) {
      return NextResponse.json({
        success: false,
        error: '所有采购记录验证失败',
        failed: failedItems,
      }, { status: 400 });
    }

    // 批量创建（使用事务）
    const batchResults = await db.transaction(async (tx) => {
      const results: Array<{ demandId: number; recordId: number; error?: string }> = [];

      for (const item of items) {
        // 跳过已验证失败的
        if (failedItems.some(f => f.index === items.indexOf(item))) {
          continue;
        }

        try {
          // 计算总价
          const purchaseQty = Number(item.purchaseQty) || 1;
          const shippingFee = Number(item.shippingFee) || 0;
          const totalPurchaseCost = Number(item.purchasePrice) * purchaseQty + shippingFee;

          // 获取店铺ID
          const demand = await tx
            .select({ orderId: purchaseDemands.orderId })
            .from(purchaseDemands)
            .where(eq(purchaseDemands.id, item.demandId))
            .limit(1);

          let shopId: string | null = null;
          let ozonOrderIds: string[] = [];

          if (demand.length > 0) {
            const order = await tx
              .select({ shopId: ozonOrders.shopId })
              .from(ozonOrders)
              .where(eq(ozonOrders.id, Number(demand[0].orderId)))
              .limit(1);
            
            if (order.length > 0) {
              shopId = order[0].shopId;
            }

            // 如果有快递号，建立映射
            if (item.trackingNo) {
              ozonOrderIds = [demand[0].orderId.toString()];
            }
          }

          // 创建采购记录
          const [newRecord] = await tx.insert(purchaseRecords).values({
            demandId: item.demandId,
            shopId: shopId!,
            ozonOrderIds: ozonOrderIds.length > 0 ? ozonOrderIds : undefined,
            supplierName: item.supplierName,
            supplierSource: item.supplierSource,
            sourceUrl: item.sourceUrl,
            purchasePrice: item.purchasePrice,
            purchaseQty,
            totalPurchaseCost: String(totalPurchaseCost),
            shippingFee: String(shippingFee),
            domesticTrackingNo: item.trackingNo,
            status: 'ordered',
            domesticStatus: item.trackingNo ? 'pending' : undefined,
            purchaserId: item.purchaserId,
            boundBy: item.boundBy,
            remark: item.remark,
            orderedAt: new Date(),
          } as InsertPurchaseRecord).returning();

          // 更新采购需求状态
          await tx.update(purchaseDemands)
            .set({ status: 'purchased', updatedAt: new Date() })
            .where(eq(purchaseDemands.id, item.demandId));

          results.push({
            demandId: item.demandId,
            recordId: Number(newRecord.id),
          });
        } catch (err) {
          console.error(`Error creating record for demand ${item.demandId}:`, err);
          results.push({
            demandId: item.demandId,
            recordId: 0,
            error: String(err),
          });
        }
      }

      return results;
    });

    // 统计结果
    const succeeded = batchResults.filter(r => !r.error);
    const failed = batchResults.filter(r => r.error);

    return NextResponse.json({
      success: true,
      count: succeeded.length,
      failed: [...failedItems, ...failed.map(f => ({
        demandId: f.demandId,
        error: f.error,
      }))],
      message: `成功创建${succeeded.length}条采购记录`,
    }, { status: 201 });
  } catch (error) {
    console.error('Error batch creating purchase records:', error);
    return NextResponse.json(
      { success: false, error: '批量创建采购记录失败' },
      { status: 500 }
    );
  }
}
