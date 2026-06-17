import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { orders, orderFinance, shops } from '@/storage/database/shared/schema';
import { eq, and, desc, sql, isNull } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '20'), 100);
    const orderId = searchParams.get('orderId');
    const shopId = searchParams.get('shopId');
    const settled = searchParams.get('settled'); // 'true' | 'false' | null
    const offset = (page - 1) * pageSize;

    const whereClause = and(
      orderId ? eq(orders.id, orderId) : undefined,
      shopId ? eq(orders.shopId, shopId) : undefined,
      settled === 'true' ? eq(orderFinance.isSettled, true) : undefined,
      settled === 'false' ? isNull(orderFinance.isSettled) : undefined,
    );

    const data = await db
      .select({
        order: {
          id: orders.id,
          ozonOrderId: orders.ozonOrderId,
          shopId: orders.shopId,
          status: orders.status,
          erpStatus: orders.erpStatus,
          createdAt: orders.createdAt,
        },
        finance: {
          id: orderFinance.id,
          ozonSettlementAmount: orderFinance.ozonSettlementAmount,
          purchaseAmount: orderFinance.purchaseAmount,
          domesticShippingFee: orderFinance.domesticShippingFee,
          internationalShippingFee: orderFinance.internationalShippingFee,
          otherCost: orderFinance.otherCost,
          totalCost: orderFinance.totalCost,
          profit: orderFinance.profit,
          profitRate: orderFinance.profitRate,
          freightReconciled: orderFinance.freightReconciled,
          isSettled: orderFinance.isSettled,
        }
      })
      .from(orders)
      .leftJoin(orderFinance, eq(orders.id, orderFinance.orderId))
      .where(whereClause)
      .orderBy(sql`${orders.createdAt} DESC`)
      .limit(pageSize)
      .offset(offset);

    const result = data.map(item => ({
      orderId: item.order.id,
      ozonOrderId: item.order.ozonOrderId,
      shopId: item.order.shopId,
      status: item.order.status,
      erpStatus: item.order.erpStatus,
      createdAt: item.order.createdAt,
      ozonSettlementAmount: item.finance?.ozonSettlementAmount,
      purchaseAmount: item.finance?.purchaseAmount,
      domesticShippingFee: item.finance?.domesticShippingFee,
      internationalShippingFee: item.finance?.internationalShippingFee,
      otherCost: item.finance?.otherCost,
      totalCost: item.finance?.totalCost,
      profit: item.finance?.profit,
      profitRate: item.finance?.profitRate,
      freightReconciled: item.finance?.freightReconciled,
      isSettled: item.finance?.isSettled,
      dataQualityWarning: !item.finance?.purchaseAmount || item.finance.purchaseAmount === '0',
    }));

    return NextResponse.json({ success: true, data: result, total: result.length, page, pageSize });
  } catch (error) {
    console.error('[Finance/Orders] GET error:', error);
    return NextResponse.json({ success: false, error: '查询失败' }, { status: 500 });
  }
}
