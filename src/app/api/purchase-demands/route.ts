import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { purchaseDemands, ozonOrders } from '@/storage/database/shared/fulfillment';
import { eq, and, desc, asc, inArray, sql } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';
    const shopId = searchParams.get('shopId');
    const viewMode = searchParams.get('viewMode') || 'list';
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    if (viewMode === 'aggregate') {
      // 聚合视图：按SKU分组
      const results = await db
        .select({
          id: purchaseDemands.id,
          sku: purchaseDemands.sku,
          productName: purchaseDemands.productName,
          productImage: purchaseDemands.productImage,
          totalQty: purchaseDemands.quantity,
          priority: purchaseDemands.priority,
          orderId: purchaseDemands.orderId,
          earliestDeadline: ozonOrders.shipmentDeadline,
        })
        .from(purchaseDemands)
        .leftJoin(ozonOrders, eq(ozonOrders.id, purchaseDemands.orderId))
        .where(status !== 'all' ? eq(purchaseDemands.status, status) : undefined);

      // 按SKU聚合
      const skuMap = new Map<string, {
        sku: string;
        productName: string | null;
        productImage: string | null;
        totalQty: number;
        demandCount: number;
        earliestDeadline: string | null;
        priorities: { high: number; normal: number; low: number };
        demands: Array<{ id: number; orderId: number; quantity: number; priority: string; deadline: string | null }>;
      }>();

      for (const row of results) {
        const sku = String(row.sku || '');
        const existing = skuMap.get(sku);
        const priority = String(row.priority || 'normal');
        const deadlineStr = row.earliestDeadline 
          ? String(row.earliestDeadline) 
          : null;

        if (!existing) {
          // 新SKU，创建聚合数据
          skuMap.set(sku, {
            sku: sku,
            productName: row.productName,
            productImage: row.productImage,
            totalQty: Number(row.totalQty) || 0,
            demandCount: 1,
            earliestDeadline: deadlineStr,
            priorities: { 
              high: priority === 'high' ? 1 : 0, 
              normal: priority === 'normal' ? 1 : 0, 
              low: priority === 'low' ? 1 : 0 
            },
            demands: [{
              id: Number(row.id),
              orderId: Number(row.orderId),
              quantity: Number(row.totalQty) || 0,
              priority: priority,
              deadline: deadlineStr,
            }],
          });
        } else {
          // 已有SKU，累加数据
          existing.totalQty += Number(row.totalQty) || 0;
          existing.demandCount += 1;
          
          // 统计优先级
          if (priority === 'high') existing.priorities.high++;
          else if (priority === 'normal') existing.priorities.normal++;
          else existing.priorities.low++;
          
          // 更新最早截止时间
          if (deadlineStr && (!existing.earliestDeadline || deadlineStr < existing.earliestDeadline)) {
            existing.earliestDeadline = deadlineStr;
          }
          
          existing.demands.push({
            id: Number(row.id),
            orderId: Number(row.orderId),
            quantity: Number(row.totalQty) || 0,
            priority: priority,
            deadline: deadlineStr,
          });
        }
      }

      // 转换为数组并排序
      const aggregated = Array.from(skuMap.values())
        .map(agg => ({
          sku: agg.sku,
          productName: agg.productName,
          productImage: agg.productImage,
          totalQty: agg.totalQty,
          demandCount: agg.demandCount,
          earliestDeadline: agg.earliestDeadline,
          priorities: agg.priorities,
          demands: agg.demands,
        }))
        .sort((a, b) => {
          // high优先 > normal > low
          const priorityOrder = { high: 0, normal: 1, low: 2 };
          const aHighestPriority = Math.min(...a.demands.map(d => priorityOrder[d.priority as keyof typeof priorityOrder] ?? 1));
          const bHighestPriority = Math.min(...b.demands.map(d => priorityOrder[d.priority as keyof typeof priorityOrder] ?? 1));
          if (aHighestPriority !== bHighestPriority) {
            return aHighestPriority - bHighestPriority;
          }
          // 然后按最早截止时间排序
          const aTime = a.earliestDeadline ? new Date(a.earliestDeadline).getTime() : Infinity;
          const bTime = b.earliestDeadline ? new Date(b.earliestDeadline).getTime() : Infinity;
          return aTime - bTime;
        });

      return NextResponse.json({
        success: true,
        data: aggregated.slice(offset, offset + limit),
        total: aggregated.length,
        offset,
        limit,
      });
    } else {
      // 列表视图
      const results = await db
        .select({
          id: purchaseDemands.id,
          orderId: purchaseDemands.orderId,
          sku: purchaseDemands.sku,
          productName: purchaseDemands.productName,
          productImage: purchaseDemands.productImage,
          quantity: purchaseDemands.quantity,
          priority: purchaseDemands.priority,
          status: purchaseDemands.status,
          createdAt: purchaseDemands.createdAt,
          updatedAt: purchaseDemands.updatedAt,
          // 订单信息
          orderStatus: ozonOrders.orderStatus,
          orderAmount: ozonOrders.orderAmount,
          shipmentDeadline: ozonOrders.shipmentDeadline,
          orderTime: ozonOrders.orderTime,
        })
        .from(purchaseDemands)
        .leftJoin(ozonOrders, eq(ozonOrders.id, purchaseDemands.orderId))
        .where(status !== 'all' ? eq(purchaseDemands.status, status) : undefined)
        .orderBy(
          // high优先，然后normal，然后low
          sql`CASE ${purchaseDemands.priority} WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END`,
          ozonOrders.shipmentDeadline,
          purchaseDemands.createdAt
        )
        .limit(limit)
        .offset(offset);

      return NextResponse.json({
        success: true,
        data: results.map(r => ({
          ...r,
          orderAmount: r.orderAmount ? Number(r.orderAmount) : null,
        })),
        offset,
        limit,
      });
    }
  } catch (error) {
    console.error('Error fetching purchase demands:', error);
    return NextResponse.json(
      { success: false, error: '获取采购需求列表失败' },
      { status: 500 }
    );
  }
}
