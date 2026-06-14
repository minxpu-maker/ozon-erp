import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { ozonCategoryCommissions, logisticsEstimates, exchangeRates } from '@/storage/database/shared/schema';
import { eq, and, lte, gte } from 'drizzle-orm';

/**
 * POST /api/profit-calculator
 * 利润计算器
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      price,           // 售价(₽)
      purchaseCost,    // 采购成本(¥)
      shippingCost,    // 运费(¥)
      weight = 100,    // 重量(g)
      categoryPath,    // 类目路径
      exchangeRate: providedRate,  // 自定义汇率
      targetProfitRate = 30,      // 目标利润率(%)
    } = body;
    
    if (!price || !purchaseCost) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数：price, purchaseCost' },
        { status: 400 }
      );
    }
    
    // 1. 获取汇率
    let exchangeRate = providedRate || 0.08; // 默认0.08
    
    const [rate] = await db
      .select({ rate: exchangeRates.rate })
      .from(exchangeRates)
      .where(eq(exchangeRates.currencyPair, 'RUB_CNY'))
      .limit(1);
    
    if (rate) {
      exchangeRate = Number(rate.rate);
    }
    
    // 2. 获取类目佣金率
    let commissionRate = 0.15; // 默认15%
    let minCommission = 0;
    
    // 尝试匹配类目
    if (categoryPath) {
      const [commission] = await db
        .select({
          commissionRate: ozonCategoryCommissions.commissionRate,
          minCommission: ozonCategoryCommissions.minCommission,
        })
        .from(ozonCategoryCommissions)
        .where(
          and(
            eq(ozonCategoryCommissions.isActive, true),
            // 简单匹配：检查类目路径是否包含类目名称
          )
        )
        .limit(1);
      
      if (commission) {
        commissionRate = Number(commission.commissionRate);
        minCommission = Number(commission.minCommission) || 0;
      }
    }
    
    // 3. 获取物流费用估算
    let logisticsCostCny = 5; // 默认5元
    const [logistics] = await db
      .select({ estimatedCostCny: logisticsEstimates.estimatedCostCny })
      .from(logisticsEstimates)
      .where(
        and(
          eq(logisticsEstimates.isActive, true),
          eq(logisticsEstimates.logisticsType, 'FBS'),
          lte(logisticsEstimates.weightMin, weight),
          gte(logisticsEstimates.weightMax, weight)
        )
      )
      .limit(1);
    
    if (logistics) {
      logisticsCostCny = Number(logistics.estimatedCostCny);
    }
    
    // 4. 计算Ozon佣金
    let ozonCommission = price * commissionRate;
    if (minCommission > 0 && ozonCommission < minCommission) {
      ozonCommission = minCommission;
    }
    
    // 5. 计算利润
    const revenueRmb = price * exchangeRate; // 收入(¥)
    const costTotal = purchaseCost + shippingCost + logisticsCostCny; // 总成本(¥)
    const profit = revenueRmb - ozonCommission * exchangeRate - costTotal; // 利润(¥)
    const profitRate = revenueRmb > 0 ? (profit / revenueRmb) * 100 : 0; // 利润率(%)
    const roi = costTotal > 0 ? (profit / costTotal) * 100 : 0; // ROI(%)
    
    // 6. 计算建议售价（目标利润率30%）
    // 利润 = (price - ozonCommission) * exchangeRate - costTotal
    // 目标利润 = revenueRmb * targetProfitRate / 100
    // 简化计算: price = (costTotal / exchangeRate + ozonCommission) / (1 - targetProfitRate / 100)
    const targetProfit = revenueRmb * (targetProfitRate / 100);
    const suggestedPrice = (costTotal / exchangeRate + ozonCommission) / (1 - targetProfitRate / 100);
    
    return NextResponse.json({
      success: true,
      data: {
        // 输入参数
        inputs: {
          price,
          purchaseCost,
          shippingCost: shippingCost || 0,
          weight,
          exchangeRate,
          targetProfitRate,
        },
        // 计算结果
        profit: Math.round(profit * 100) / 100,      // 利润(¥)
        profitRate: Math.round(profitRate * 100) / 100, // 利润率(%)
        roi: Math.round(roi * 100) / 100,           // ROI(%)
        suggestedPrice: Math.round(suggestedPrice * 100) / 100, // 建议售价(₽)
        // 费用明细
        breakdown: {
          ozonCommission: Math.round(ozonCommission * 100) / 100, // Ozon佣金(₽)
          commissionRate: commissionRate * 100,        // 佣金率(%)
          commissionRateDecimal: commissionRate,        // 佣金率(小数)
          logisticsCost: logisticsCostCny,             // 物流费估算(¥)
          exchangeRate,
          revenueRmb: Math.round(revenueRmb * 100) / 100, // 收入(¥)
          costBreakdown: {
            purchaseCost,
            shippingCost: shippingCost || 0,
            logisticsCost: logisticsCostCny,
            total: Math.round(costTotal * 100) / 100,
          },
        },
      },
    });
  } catch (error) {
    console.error('利润计算失败:', error);
    return NextResponse.json(
      { success: false, error: '计算失败' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/profit-calculator/commission-rates
 * 获取类目佣金率列表
 */
export async function GET(request: NextRequest) {
  try {
    const rates = await db
      .select({
        ozonCategoryId: ozonCategoryCommissions.ozonCategoryId,
        categoryName: ozonCategoryCommissions.categoryName,
        commissionRate: ozonCategoryCommissions.commissionRate,
        minCommission: ozonCategoryCommissions.minCommission,
      })
      .from(ozonCategoryCommissions)
      .where(eq(ozonCategoryCommissions.isActive, true));
    
    return NextResponse.json({
      success: true,
      data: rates.map(r => ({
        ...r,
        commissionRate: Number(r.commissionRate) * 100, // 转为百分比
        minCommission: Number(r.minCommission),
      })),
    });
  } catch (error) {
    console.error('获取佣金率失败:', error);
    return NextResponse.json(
      { success: false, error: '获取失败' },
      { status: 500 }
    );
  }
}
