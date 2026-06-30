import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { purchaseRecords, ozonOrders } from '@/storage/database/shared/fulfillment';
import { eq, and, isNull, or, gte, sql, sum } from 'drizzle-orm';

/**
 * GET - 采购工作台摘要统计
 * 返回各状态的采购数量统计
 */
export async function GET(request: NextRequest) {
  try {
    // 1. pendingPurchaseCount - 待采购订单数
    // 查询 ozon_orders 表中 order_status = 'awaiting_deliver' AND erp_status = 'pending_purchase'
    const pendingPurchaseResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(ozonOrders)
      .where(and(
        eq(ozonOrders.orderStatus, 'awaiting_deliver'),
        eq(ozonOrders.erpStatus, 'pending_purchase')
      ));
    
    const pendingPurchaseCount = Number(pendingPurchaseResult[0]?.count || 0);

    // 2. orderedCount - 已下单采购数（status = 'ordered'）
    const orderedResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(purchaseRecords)
      .where(eq(purchaseRecords.status, 'ordered'));
    
    const orderedCount = Number(orderedResult[0]?.count || 0);

    // 3. orderedWithoutTrackingCount - 已下单无快递单号数
    // status = 'ordered' 且 domestic_tracking_no IS NULL 或 = ''
    const orderedWithoutTrackingResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(purchaseRecords)
      .where(and(
        eq(purchaseRecords.status, 'ordered'),
        or(
          isNull(purchaseRecords.domesticTrackingNo),
          eq(purchaseRecords.domesticTrackingNo, '')
        )
      ));
    
    const orderedWithoutTrackingCount = Number(orderedWithoutTrackingResult[0]?.count || 0);

    // 4. inTransitCount - 运输中数量（status = 'shipped'）
    const inTransitResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(purchaseRecords)
      .where(eq(purchaseRecords.status, 'shipped'));
    
    const inTransitCount = Number(inTransitResult[0]?.count || 0);

    // 5. receivedCount - 已到货数量（status = 'received'）
    const receivedResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(purchaseRecords)
      .where(eq(purchaseRecords.status, 'received'));
    
    const receivedCount = Number(receivedResult[0]?.count || 0);

    // 6. todayPurchasedCount & 7. todayPurchasedAmount
    // 今日零点（服务器时区）
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // ordered_at >= 今日零点的计数和金额求和
    const todayStatsResult = await db
      .select({
        count: sql<number>`count(*)`,
        totalAmount: sql<string>`COALESCE(SUM(total_purchase_cost), 0)`,
      })
      .from(purchaseRecords)
      .where(gte(purchaseRecords.orderedAt, today));
    
    const todayPurchasedCount = Number(todayStatsResult[0]?.count || 0);
    const todayPurchasedAmount = Number(todayStatsResult[0]?.totalAmount || 0);

    return NextResponse.json({
      data: {
        pendingPurchaseCount,
        orderedCount,
        orderedWithoutTrackingCount,
        inTransitCount,
        receivedCount,
        todayPurchasedCount,
        todayPurchasedAmount,
      },
    });
  } catch (error) {
    console.error('Error fetching purchase stats:', error);
    return NextResponse.json(
      { success: false, error: '获取采购统计失败' },
      { status: 500 }
    );
  }
}