/**
 * 订单财务列表API
 * GET /api/finance/orders
 */
import { NextRequest, NextResponse } from 'next/server';
import { eq, and, gte, lte, or, isNull, sql } from 'drizzle-orm';
import { db } from '@/storage/database/client';
import { ozonOrders, orderFinance } from '@/storage/database/shared/fulfillment';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // 解析查询参数
    const shopId = searchParams.get('shopId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const minMargin = searchParams.get('minMargin');
    const maxMargin = searchParams.get('maxMargin');
    const status = searchParams.get('status'); // estimated/calculated/settled
    const hasZeroCost = searchParams.get('hasZeroCost'); // 筛选采购成本为0的
    const reconciled = searchParams.get('reconciled'); // 运费核对状态
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '50');
    const offset = (page - 1) * pageSize;
    
    // 构建查询条件
    const conditions: any[] = [];
    
    if (shopId) {
      conditions.push(eq(orderFinance.shopId, shopId));
    }
    
    if (startDate) {
      conditions.push(gte(orderFinance.createdAt, new Date(startDate)));
    }
    
    if (endDate) {
      conditions.push(lte(orderFinance.createdAt, new Date(endDate)));
    }
    
    if (status) {
      conditions.push(eq(orderFinance.status, status));
    }
    
    // 利润率筛选（使用netMargin字段）
    if (minMargin) {
      conditions.push(sql`${orderFinance.netMargin} >= ${parseFloat(minMargin)}`);
    }
    
    if (maxMargin) {
      conditions.push(sql`${orderFinance.netMargin} <= ${parseFloat(maxMargin)}`);
    }
    
    // 采购成本为0的筛选
    if (hasZeroCost === 'true') {
      conditions.push(
        or(
          isNull(orderFinance.purchaseCost),
          sql`${orderFinance.purchaseCost} = 0`,
          sql`${orderFinance.purchaseCost} = '0'`
        )!
      );
    }
    
    // 运费核对状态筛选
    if (reconciled !== null && reconciled !== undefined) {
      const reconciledNum = reconciled === '1' ? 1 : 0;
      conditions.push(eq(orderFinance.freightReconciled, reconciledNum));
    }
    
    // 查询订单及其财务数据
    const orders = await db
      .select({
        order: {
          id: ozonOrders.id,
          shopId: ozonOrders.shopId,
          ozonOrderId: ozonOrders.ozonOrderId,
          ozonPostingNumber: ozonOrders.ozonPostingNumber,
          orderStatus: ozonOrders.orderStatus,
          erpStatus: ozonOrders.erpStatus,
          customerName: ozonOrders.customerName,
          createdAt: ozonOrders.createdAt
        },
        finance: {
          settlementAmountCny: orderFinance.settlementAmountCny,
          exchangeRate: orderFinance.exchangeRate,
          purchaseCost: orderFinance.purchaseCost,
          domesticShippingCost: orderFinance.domesticShippingCost,
          ozonCommission: orderFinance.ozonCommission,
          ozonPaymentFee: orderFinance.ozonPaymentFee,
          internationalShippingCost: orderFinance.internationalShippingCost,
          packagingCost: orderFinance.packagingCost,
          netProfit: orderFinance.netProfit,
          netMargin: orderFinance.netMargin,
          status: orderFinance.status,
          createdAt: orderFinance.createdAt,
          actualWeight: orderFinance.actualWeight,
          estimatedShippingCost: orderFinance.estimatedShippingCost,
          logisticsBillAmount: orderFinance.logisticsBillAmount,
          freightVariance: orderFinance.freightVariance,
          freightReconciled: orderFinance.freightReconciled,
          reconciledAt: orderFinance.reconciledAt
        }
      })
      .from(orderFinance)
      .leftJoin(ozonOrders, eq(ozonOrders.id, orderFinance.orderId))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(sql`${orderFinance.createdAt} DESC`)
      .limit(pageSize)
      .offset(offset);
    
    // 统计总数
    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(orderFinance)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    
    const total = countResult[0]?.count || 0;
    
    // 处理数据质量标记
    const dataWithQualityFlag = orders.map(item => {
      const purchaseCostNum = item.finance?.purchaseCost 
        ? parseFloat(String(item.finance.purchaseCost)) 
        : 0;
      
      return {
        ...item,
        dataQualityWarning: purchaseCostNum === 0,
        // 格式化金额字段用于前端显示（前端负责格式化）
        formattedAmount: item.finance.settlementAmountCny 
          ? parseFloat(String(item.finance.settlementAmountCny)).toFixed(2)
          : '0.00',
        formattedProfit: item.finance.netProfit 
          ? parseFloat(String(item.finance.netProfit)).toFixed(2)
          : '0.00',
        formattedMargin: item.finance.netMargin 
          ? `${parseFloat(String(item.finance.netMargin)).toFixed(2)}%`
          : '0.00%'
      };
    });
    
    return NextResponse.json({
      success: true,
      data: dataWithQualityFlag,
      total,
      offset,
      limit: pageSize,
      page,
      pageSize
    });
  } catch (error) {
    console.error('查询订单财务列表失败:', error);
    return NextResponse.json(
      { success: false, error: '查询失败' },
      { status: 500 }
    );
  }
}
