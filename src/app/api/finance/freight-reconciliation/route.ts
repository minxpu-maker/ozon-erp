/**
 * 运费核对API
 * GET /api/finance/freight-reconciliation - 查询运费核对列表
 * POST /api/finance/freight-reconciliation - 录入物流账单金额
 */
import { NextRequest, NextResponse } from 'next/server';
import { eq, and, or, gte, lte, sql, inArray } from 'drizzle-orm';
import { db } from '@/storage/database/client';
import { ozonOrders, orderFinance } from '@/storage/database/shared/fulfillment';

interface FreightReconciliationItem {
  orderId: number;
  logisticsBillAmount: number;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // 解析查询参数
    const shopId = searchParams.get('shopId');
    const reconciled = searchParams.get('reconciled'); // 0未核对, 1已核对
    const month = searchParams.get('month'); // YYYY-MM格式
    const varianceThreshold = searchParams.get('varianceThreshold'); // 差异率阈值，如5, 20
    const offset = parseInt(searchParams.get('offset') || '0');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    
    // 构建查询条件
    const conditions = [];
    
    if (shopId) {
      conditions.push(eq(ozonOrders.shopId, shopId));
    }
    
    // 月份筛选
    if (month) {
      const startDate = new Date(month + '-01');
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 1);
      conditions.push(gte(ozonOrders.createdAt, startDate));
      conditions.push(lte(ozonOrders.createdAt, endDate));
    }
    
    // 核对状态筛选
    if (reconciled === '0') {
      conditions.push(
        sql`${orderFinance.freightReconciled} IS NULL OR ${orderFinance.freightReconciled} = 0` as ReturnType<typeof eq>
      );
    } else if (reconciled === '1') {
      conditions.push(
        eq(orderFinance.freightReconciled, 1)
      );
    }
    
    // 已有称重数据（预估运费）
    conditions.push(
      sql`${orderFinance.estimatedShippingCost} IS NOT NULL AND ${orderFinance.estimatedShippingCost} > 0` as ReturnType<typeof eq>
    );
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    // 查询数据
    const data = await db
      .select({
        order: {
          id: ozonOrders.id,
          shopId: ozonOrders.shopId,
          ozonOrderId: ozonOrders.ozonOrderId,
          ozonPostingNumber: ozonOrders.ozonPostingNumber,
          erpStatus: ozonOrders.erpStatus,
          createdAt: ozonOrders.createdAt
        },
        finance: {
          actualWeight: orderFinance.actualWeight,
          estimatedShippingCost: orderFinance.estimatedShippingCost,
          logisticsBillAmount: orderFinance.logisticsBillAmount,
          freightVariance: orderFinance.freightVariance,
          freightReconciled: orderFinance.freightReconciled,
          reconciledAt: orderFinance.reconciledAt
        }
      })
      .from(ozonOrders)
      .innerJoin(orderFinance, eq(ozonOrders.id, orderFinance.orderId))
      .where(whereClause)
      .orderBy(sql`${ozonOrders.createdAt} DESC`)
      .limit(limit)
      .offset(offset);
    
    // 统计总数
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(ozonOrders)
      .innerJoin(orderFinance, eq(ozonOrders.id, orderFinance.orderId))
      .where(whereClause);
    
    const total = countResult[0]?.count || 0;
    
    // 计算汇总数据
    const summary = {
      totalUnreconciled: 0,
      varianceAbove5Percent: 0,
      varianceAbove20Percent: 0,
      totalVarianceAmount: 0
    };
    
    // 格式化数据并计算汇总
    const formattedData = data.map(item => {
      const actualWeight = item.finance.actualWeight 
        ? parseFloat(item.finance.actualWeight) 
        : null;
      const estimatedShippingCost = item.finance.estimatedShippingCost 
        ? parseFloat(item.finance.estimatedShippingCost) 
        : 0;
      const logisticsBillAmount = item.finance.logisticsBillAmount 
        ? parseFloat(item.finance.logisticsBillAmount) 
        : null;
      const freightVariance = item.finance.freightVariance 
        ? parseFloat(item.finance.freightVariance) 
        : null;
      
      // 计算差异率
      let variancePercent: number | null = null;
      if (freightVariance !== null && estimatedShippingCost > 0) {
        variancePercent = (Math.abs(freightVariance) / estimatedShippingCost) * 100;
      }
      
      // 统计
      const isReconciled = item.finance.freightReconciled === 1;
      if (!isReconciled) {
        summary.totalUnreconciled++;
        if (variancePercent !== null) {
          if (variancePercent > 5) summary.varianceAbove5Percent++;
          if (variancePercent > 20) summary.varianceAbove20Percent++;
        }
        if (freightVariance !== null) {
          summary.totalVarianceAmount += freightVariance;
        }
      }
      
      return {
        orderId: item.order.id,
        ozonOrderId: item.order.ozonOrderId,
        ozonPostingNumber: item.order.ozonPostingNumber,
        erpStatus: item.order.erpStatus,
        createdAt: item.order.createdAt,
        actualWeight,
        estimatedShippingCost,
        logisticsBillAmount,
        freightVariance,
        variancePercent,
        freightReconciled: isReconciled,
        reconciledAt: item.finance.reconciledAt,
        // 数据质量标记
        dataQualityWarning: logisticsBillAmount === null
      };
    });
    
    // 按差异率筛选（如果指定了阈值）
    let filteredData = formattedData;
    if (varianceThreshold) {
      const threshold = parseFloat(varianceThreshold);
      filteredData = formattedData.filter(item => 
        item.variancePercent !== null && item.variancePercent > threshold
      );
    }
    
    return NextResponse.json({
      success: true,
      data: filteredData,
      total,
      offset,
      limit,
      summary
    });
  } catch (error) {
    console.error('[FreightReconciliation] 查询失败:', error);
    return NextResponse.json(
      { success: false, error: '查询失败' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { items } = body as { items: FreightReconciliationItem[] };
    
    // 验证参数
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'items参数必填且为非空数组' },
        { status: 400 }
      );
    }
    
    // 限制批量大小
    const maxBatchSize = 100;
    if (items.length > maxBatchSize) {
      return NextResponse.json(
        { success: false, error: `单次批量不能超过${maxBatchSize}笔` },
        { status: 400 }
      );
    }
    
    // 验证数据有效性
    const validItems: FreightReconciliationItem[] = [];
    for (const item of items) {
      if (!item.orderId || typeof item.orderId !== 'number') {
        return NextResponse.json(
          { success: false, error: `orderId无效: ${JSON.stringify(item)}` },
          { status: 400 }
        );
      }
      if (item.logisticsBillAmount === undefined || isNaN(parseFloat(String(item.logisticsBillAmount)))) {
        return NextResponse.json(
          { success: false, error: `logisticsBillAmount无效: ${JSON.stringify(item)}` },
          { status: 400 }
        );
      }
      validItems.push({
        orderId: item.orderId,
        logisticsBillAmount: parseFloat(String(item.logisticsBillAmount))
      });
    }
    
    const orderIds = validItems.map(item => item.orderId);
    
    console.log(`[FreightReconciliation] 录入 ${items.length} 笔物流账单`);
    
    // 1. 批量查询order_finance获取预估运费
    const finances = await db
      .select()
      .from(orderFinance)
      .where(inArray(orderFinance.orderId, orderIds));
    
    const financeMap = new Map(finances.map(f => [f.orderId, f]));
    
    // 检查不存在的记录
    const missingOrders = orderIds.filter(id => !financeMap.has(id));
    if (missingOrders.length > 0) {
      return NextResponse.json({
        success: false,
        error: `部分订单财务记录不存在: ${missingOrders.join(', ')}`
      }, { status: 400 });
    }
    
    // 2. 批量更新
    const results = [];
    for (const item of validItems) {
      const finance = financeMap.get(item.orderId)!;
      const estimatedShippingCost = finance.estimatedShippingCost 
        ? parseFloat(finance.estimatedShippingCost) 
        : 0;
      
      // 计算差异
      const freightVariance = item.logisticsBillAmount - estimatedShippingCost;
      const variancePercent = estimatedShippingCost > 0 
        ? (Math.abs(freightVariance) / estimatedShippingCost) * 100 
        : null;
      
      await db
        .update(orderFinance)
        .set({
          logisticsBillAmount: item.logisticsBillAmount.toString(),
          freightVariance: freightVariance.toString(),
          updatedAt: new Date()
        })
        .where(eq(orderFinance.orderId, item.orderId));
      
      results.push({
        orderId: item.orderId,
        logisticsBillAmount: item.logisticsBillAmount,
        estimatedShippingCost,
        freightVariance,
        variancePercent
      });
    }
    
    console.log(`[FreightReconciliation] 录入完成: ${results.length} 笔`);
    
    // 汇总
    const summary = {
      total: results.length,
      varianceAbove5Percent: results.filter(r => r.variancePercent !== null && r.variancePercent > 5).length,
      varianceAbove20Percent: results.filter(r => r.variancePercent !== null && r.variancePercent > 20).length,
      totalVarianceAmount: results.reduce((sum, r) => sum + r.freightVariance, 0)
    };
    
    return NextResponse.json({
      success: true,
      count: results.length,
      summary,
      results
    });
  } catch (error) {
    console.error('[FreightReconciliation] 录入失败:', error);
    return NextResponse.json(
      { success: false, error: '录入失败' },
      { status: 500 }
    );
  }
}
