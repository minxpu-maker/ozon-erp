/**
 * 财务核算引擎
 * 用于计算订单利润、更新财务记录
 */
import { eq, and, inArray } from 'drizzle-orm';
import { db } from '@/storage/database/client';
import { ozonOrders, purchaseRecords, shipmentRecords, orderFinance } from '@/storage/database/shared/fulfillment';

// 汇率缓存
let exchangeRateCache: {
  rate: number;
  timestamp: number;
} | null = null;

const CACHE_DURATION = 60 * 60 * 1000; // 1小时缓存

/**
 * 获取RUB到CNY汇率
 */
export async function getExchangeRate(): Promise<number> {
  const now = Date.now();
  
  // 检查缓存
  if (exchangeRateCache && (now - exchangeRateCache.timestamp) < CACHE_DURATION) {
    return exchangeRateCache.rate;
  }
  
  try {
    const response = await fetch('https://open.er-api.com/v6/latest/RUB', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      next: { revalidate: 3600 } // Next.js缓存1小时
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    const rate = data.rates?.CNY;
    
    if (!rate || typeof rate !== 'number') {
      throw new Error('Invalid rate response');
    }
    
    // 更新缓存
    exchangeRateCache = {
      rate: rate,
      timestamp: now
    };
    
    console.log(`[Finance] 汇率更新: 1 RUB = ${rate} CNY`);
    return rate;
  } catch (error) {
    console.error('[Finance] 获取汇率失败:', error);
    // 使用默认汇率（环境变量）
    const defaultRate = parseFloat(process.env.DEFAULT_RUB_CNY_RATE || '0.08');
    console.log(`[Finance] 使用默认汇率: ${defaultRate}`);
    return defaultRate;
  }
}

/**
 * 格式化货币金额
 */
export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '¥0.00';
  }
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

/**
 * 计算订单财务数据
 */
export async function calculateFinance(orderId: number): Promise<{
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}> {
  try {
    // 1. 查询订单信息
    const [order] = await db
      .select()
      .from(ozonOrders)
      .where(eq(ozonOrders.id, orderId))
      .limit(1);
    
    if (!order) {
      return { success: false, error: '订单不存在' };
    }
    
    // 2. 查询采购记录（可能没有）- 通过demandId关联
    // purchase_records.ozonOrderIds 包含关联的订单ID
    const { sql } = await import('drizzle-orm');
    const purchaseResult = await db.execute(
      sql`SELECT * FROM purchase_records WHERE ozon_order_ids @> ${JSON.stringify([orderId])} LIMIT 1`
    );
    const purchaseRows = purchaseResult.rows as Array<{
      purchasePrice: string | null;
      shippingFee: string | null;
      totalPurchaseCost: string | null;
    }>;
    const purchase = purchaseRows.length > 0 ? purchaseRows[0] : null;
    
    // 3. 查询发货记录（可能没有）
    const [shipment] = await db
      .select()
      .from(shipmentRecords)
      .where(eq(shipmentRecords.orderId, orderId))
      .limit(1);
    
    // 4. 查询财务记录（可能没有，需要创建）
    const [existingFinance] = await db
      .select()
      .from(orderFinance)
      .where(eq(orderFinance.orderId, orderId))
      .limit(1);
    
    // 5. 获取汇率
    const exchangeRate = await getExchangeRate();
    
    // 6. 获取结算汇率（从财务记录获取）
    const settlementExchangeRate = existingFinance?.settlementExchangeRate 
      ? parseFloat(String(existingFinance.settlementExchangeRate)) 
      : exchangeRate;
    
    // 7. 解析订单金额（RUB）- ozonOrders表中的orderAmount字段
    const orderRmbAmount = order.orderAmount 
      ? parseFloat(String(order.orderAmount)) 
      : 0;
    const ozonSettlementAmount = existingFinance?.ozonSettlementAmount 
      ? parseFloat(String(existingFinance.ozonSettlementAmount)) 
      : orderRmbAmount; // 如果没有单独存储，用订单金额
    
    // 8. 解析采购成本
    const purchaseCost = purchase?.purchasePrice 
      ? parseFloat(String(purchase.purchasePrice)) 
      : (existingFinance?.purchaseCost ? parseFloat(String(existingFinance.purchaseCost)) : 0);
    
    // 9. 解析国内运费（采购时的国内快递费）
    const domesticShippingCost = purchase?.shippingFee 
      ? parseFloat(String(purchase.shippingFee)) 
      : (existingFinance?.domesticShippingCost ? parseFloat(String(existingFinance.domesticShippingCost)) : 0);
    
    // 10. 解析国际运费（从财务记录获取，称重时写入）
    const internationalShippingCost = existingFinance?.internationalShippingCost 
      ? parseFloat(String(existingFinance.internationalShippingCost)) 
      : 0;
    
    // 11. 解析包装费（从发货记录获取）
    const packagingCost = shipment?.packingCost 
      ? parseFloat(String(shipment.packingCost)) 
      : (existingFinance?.packagingCost ? parseFloat(String(existingFinance.packagingCost)) : 0);
    
    // 12. Ozon佣金（从财务记录获取）
    const ozonCommission = existingFinance?.ozonCommission 
      ? parseFloat(String(existingFinance.ozonCommission)) 
      : (ozonSettlementAmount * 0.08); // 默认8%估算
    
    // 13. Ozon收单费（从财务记录获取）
    const ozonPaymentFee = existingFinance?.ozonPaymentFee 
      ? parseFloat(String(existingFinance.ozonPaymentFee)) 
      : 0.02 * ozonSettlementAmount; // 默认2%估算
    
    // 14. 计算金额（全部转换为CNY）
    const settlementAmountCny = ozonSettlementAmount * exchangeRate;
    const grossProfit = settlementAmountCny - purchaseCost - domesticShippingCost;
    const netProfit = grossProfit - ozonCommission - ozonPaymentFee - internationalShippingCost - packagingCost;
    const netMargin = settlementAmountCny > 0 
      ? (netProfit / settlementAmountCny) * 100 
      : 0;
    
    // 15. 汇兑损益（如有结算汇率差）
    const exchangeGainLoss = (settlementExchangeRate !== exchangeRate) 
      ? settlementAmountCny * (settlementExchangeRate - exchangeRate) / exchangeRate
      : 0;
    
    // 16. 构建更新数据
    const financeData = {
      shopId: order.shopId,
      orderId: orderId,
      // 结算金额
      ozonSettlementAmount: ozonSettlementAmount.toString(),
      settlementAmountCny: settlementAmountCny.toString(),
      exchangeRate: exchangeRate.toString(),
      settlementExchangeRate: settlementExchangeRate.toString(),
      // 成本
      purchaseCost: purchaseCost.toString(),
      domesticShippingCost: domesticShippingCost.toString(),
      ozonCommission: ozonCommission.toString(),
      ozonPaymentFee: ozonPaymentFee.toString(),
      internationalShippingCost: internationalShippingCost.toString(),
      packagingCost: packagingCost.toString(),
      // 利润
      grossProfit: grossProfit.toString(),
      netProfit: netProfit.toString(),
      netMargin: netMargin.toString(),
      exchangeGainLoss: exchangeGainLoss.toString(),
      // 状态
      status: 'calculated' as const,
      updatedAt: new Date()
    };
    
    // 17. 写入数据库
    if (existingFinance) {
      await db
        .update(orderFinance)
        .set(financeData)
        .where(eq(orderFinance.orderId, orderId));
    } else {
      await db.insert(orderFinance).values(financeData);
    }
    
    // 18. 返回计算结果
    return {
      success: true,
      data: {
        orderId,
        ozonOrderId: order.ozonOrderId,
        // 原始数据
        settlementAmount: ozonSettlementAmount,
        settlementAmountCny,
        exchangeRate,
        purchaseCost,
        domesticShippingCost,
        ozonCommission,
        ozonPaymentFee,
        internationalShippingCost,
        packagingCost,
        // 计算结果
        grossProfit,
        grossMargin: settlementAmountCny > 0 ? (grossProfit / settlementAmountCny) * 100 : 0,
        netProfit,
        netMargin,
        exchangeGainLoss,
        // 数据质量
        dataQualityWarning: purchaseCost === 0,
        status: 'calculated',
        calculatedAt: new Date()
      }
    };
  } catch (error) {
    console.error(`[Finance] 计算订单 ${orderId} 失败:`, error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '计算失败' 
    };
  }
}

/**
 * 批量计算财务数据
 */
export async function calculateFinanceBatch(orderIds: number[]): Promise<Array<{
  orderId: number;
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}>> {
  const results = [];
  
  for (const orderId of orderIds) {
    const result = await calculateFinance(orderId);
    results.push({ orderId, ...result });
  }
  
  return results;
}
