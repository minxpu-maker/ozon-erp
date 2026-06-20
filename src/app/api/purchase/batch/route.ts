import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { purchaseTasks, orders } from '@/storage/database/shared/schema';
import { eq, inArray } from 'drizzle-orm';

/**
 * POST /api/purchase/batch
 * 批量采购：支持两种格式
 * 
 * 格式1（批量创建采购任务）:
 * { orderIds: string[] }
 * - 用于从订单列表批量创建采购任务
 * - 为每个订单创建 pending_purchase 状态的采购任务
 * 
 * 格式2（批量录入快递单号）:
 * { items: Array<{
 *     orderId: string,       // 订单ID
 *     expressNo: string,     // 快递单号
 *     purchasePrice: number, // 采购价
 *     purchasePlatform?: string, // 采购平台
 *     supplierName?: string,    // 供应商名称
 *     purchaseUrl?: string,     // 采购链接
 *   }> }
 * - 用于批量绑定快递单号
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderIds, items } = body;

    // 格式1: 批量创建采购任务
    if (orderIds && Array.isArray(orderIds) && orderIds.length > 0) {
      const results = [];
      const errors = [];

      for (const orderId of orderIds) {
        try {
          // 查找订单
          const [order] = await db
            .select()
            .from(orders)
            .where(eq(orders.id, orderId))
            .limit(1);

          if (!order) {
            errors.push({ orderId, error: '订单不存在' });
            continue;
          }

          // 检查订单状态是否为 pending_purchase
          if (order.erpStatus !== 'pending_purchase') {
            errors.push({ orderId, error: `订单状态不是待采购(${order.erpStatus})` });
            continue;
          }

          // 创建采购任务
          const [task] = await db.insert(purchaseTasks).values({
            order_id: orderId,
            order_item_id: '',
            status: 'pending_purchase',
            sku_id: null,
            sku_code: '',
            quantity: 1,
            source_type: null,
            source_url: null,
            source_price: null,
            purchase_amount: null,
            shipping_fee: null,
            domestic_tracking_number: null,
            purchased_at: null,
          }).returning();

          results.push({ orderId, success: true, taskId: task.id });
        } catch (err) {
          console.error(`创建采购任务失败 ${orderId}:`, err);
          errors.push({ orderId, error: '创建失败' });
        }
      }

      return NextResponse.json({
        success: true,
        created: results.length,
        errors: errors.map(e => e.error)
      });
    }

    // 格式2: 批量录入快递单号（原有逻辑）
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: '缺少批量录入数据' }, { status: 400 });
    }

    const results = [];
    const errors = [];

    for (const item of items) {
      const { orderId, expressNo, purchasePrice, purchasePlatform, supplierName, purchaseUrl } = item;

      if (!orderId || !expressNo || purchasePrice === undefined) {
        errors.push({ orderId, error: '缺少必填字段' });
        continue;
      }

      try {
        // 查找该订单的采购任务（取最新一条pending状态的任务）
        const [task] = await db
          .select()
          .from(purchaseTasks)
          .where(eq(purchaseTasks.order_id, orderId))
          .orderBy(purchaseTasks.created_at)
          .limit(1);

        if (!task) {
          // 没有采购任务时，创建并直接标记为已采购
          const [newTask] = await db.insert(purchaseTasks).values({
            order_id: orderId,
            order_item_id: '',
            status: 'purchased',
            sku_id: null,
            sku_code: '',
            quantity: 1,
            source_type: purchasePlatform || null,
            source_url: purchaseUrl || null,
            source_price: purchasePrice,
            purchase_amount: purchasePrice,
            shipping_fee: null,
            domestic_tracking_number: expressNo,
            purchased_at: new Date(),
          }).returning();

          // 更新订单采购绑定状态
          await db.update(orders)
            .set({
              isPurchaseBound: true,
              purchaseBoundAt: new Date(),
            })
            .where(eq(orders.id, orderId));

          results.push({ orderId, success: true, taskId: newTask.id, expressNo });
        } else {
          // 更新现有任务
          const [updatedTask] = await db.update(purchaseTasks)
            .set({
              domestic_tracking_number: expressNo,
              status: 'purchased',
              is_bound: true,
              purchased_at: new Date(),
              source_type: purchasePlatform || task.source_type,
              source_url: purchaseUrl || task.source_url,
              source_price: purchasePrice,
              purchase_amount: purchasePrice,
              updated_at: new Date(),
            })
            .where(eq(purchaseTasks.id, task.id))
            .returning();

          // 更新订单采购绑定状态
          await db.update(orders)
            .set({
              isPurchaseBound: true,
              purchaseBoundAt: new Date(),
            })
            .where(eq(orders.id, orderId));

          results.push({ orderId, success: true, taskId: updatedTask.id, expressNo });
        }
      } catch (err) {
        console.error(`处理订单 ${orderId} 失败:`, err);
        errors.push({ orderId, error: '处理失败' });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        total: items.length,
        success: results.length,
        failed: errors.length,
        results,
        errors,
      },
    });
  } catch (error) {
    console.error('批量采购录入失败:', error);
    return NextResponse.json({ success: false, error: '批量录入失败' }, { status: 500 });
  }
}
