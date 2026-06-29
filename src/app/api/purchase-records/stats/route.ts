import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { purchaseRecords, ozonOrders } from '@/storage/database/shared/fulfillment';
import { eq, and, ne, sql, gte, isNull, or } from 'drizzle-orm';

/**
 * GET - 采购工作台摘要统计
 * 返回各状态的采购数量统计
 */
export async function GET(request: NextRequest) {
  try {
    // 1. pendingPurchaseCount - 待采购订单数（从 ozon_orders 表）
    const pendingPurchaseResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(ozonOrders)
      .where(eq(ozonOrders.erpStatus, 'pending_purchase'));
    
    const pendingPurchaseCount = Number(pendingPurchaseResult[0]?.count || 0);

    // 2. orderedCount - 已下单采购数（从 purchase_records 表，排除 cancelled）
    const orderedResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(purchaseRecords)
      .where(and(
        eq(purchaseRecords.status, 'ordered'),
        ne(purchaseRecords.status, 'cancelled')
      ));
    
    const orderedCount = Number(orderedResult[0]?.count || 0);

    // 3. orderedWithoutTrackingCount - 已下单无快递单号数
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

    // 4. shippedCount - 已发货（国内物流）数
    const shippedResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(purchaseRecords)
      .where(and(
        eq(purchaseRecords.status, 'shipped'),
        ne(purchaseRecords.status, 'cancelled')
      ));
    
    const shippedCount = Number(shippedResult[0]?.count || 0);

    // 5. receivedCount - 已收货数
    const receivedResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(purchaseRecords)
      .where(and(
        eq(purchaseRecords.status, 'received'),
        ne(purchaseRecords.status, 'cancelled')
      ));
    
    const receivedCount = Number(receivedResult[0]?.count || 0);

    // 6. todayPurchasedCount - 今日采购数（created_at >= 今天零点）
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayPurchasedResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(purchaseRecords)
      .where(and(
        gte(purchaseRecords.createdAt, today),
        ne(purchaseRecords.status, 'cancelled')
      ));
    
    const todayPurchasedCount = Number(todayPurchasedResult[0]?.count || 0);

    return NextResponse.json({
      success: true,
      data: {
        pendingPurchaseCount,
        orderedCount,
        orderedWithoutTrackingCount,
        shippedCount,
        receivedCount,
        todayPurchasedCount,
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