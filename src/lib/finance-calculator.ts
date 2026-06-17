/**
 * 财务核算引擎
 * 用于计算订单利润、更新财务记录
 */
import { eq } from 'drizzle-orm';
import { db } from '@/storage/database/client';
import { orders, shipmentRecords, orderFinance } from '@/storage/database/shared/schema';

let exchangeRateCache: { rate: number; timestamp: number } | null = null;
const CACHE_DURATION = 60 * 60 * 1000;

export async function getExchangeRate(): Promise<number> {
  const now = Date.now();
  if (exchangeRateCache && (now - exchangeRateCache.timestamp) < CACHE_DURATION) {
    return exchangeRateCache.rate;
  }
  try {
    const response = await fetch('https://open.er-api.com/v6/latest/RUB');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const rate = data.rates?.CNY;
    if (!rate || typeof rate !== 'number') throw new Error('Invalid rate response');
    exchangeRateCache = { rate, timestamp: now };
    console.log(`[Finance] 汇率更新: 1 RUB = ${rate} CNY`);
    return rate;
  } catch (error) {
    console.error('[Finance] 获取汇率失败:', error);
    return parseFloat(process.env.DEFAULT_RUB_CNY_RATE || '0.08');
  }
}

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return '¥0.00';
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency', currency: 'CNY',
    minimumFractionDigits: 2, maximumFractionDigits: 2
  }).format(value);
}

export async function calculateFinance(orderId: string) {
  try {
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order) return { success: false, error: '订单不存在' };

    const [shipment] = await db
      .select().from(shipmentRecords)
      .where(eq(shipmentRecords.orderId, orderId)).limit(1);

    const [existingFinance] = await db
      .select().from(orderFinance)
      .where(eq(orderFinance.orderId, orderId)).limit(1);

    const exchangeRate = await getExchangeRate();
    const settlementRate = existingFinance ? parseFloat(String(existingFinance.profitRate).split(':')[0]) || exchangeRate : exchangeRate;

    const orderRmbAmount = Number(order.totalPrice) || 0;
    const ozonSettlementAmount = existingFinance?.ozonSettlementAmount
      ? parseFloat(String(existingFinance.ozonSettlementAmount))
      : orderRmbAmount;

    const purchaseCost = existingFinance?.purchaseAmount
      ? parseFloat(String(existingFinance.purchaseAmount)) : 0;
    const domesticShippingCost = existingFinance?.domesticShippingFee
      ? parseFloat(String(existingFinance.domesticShippingFee)) : 0;
    const internationalShippingCost = existingFinance?.internationalShippingFee
      ? parseFloat(String(existingFinance.internationalShippingFee)) : 0;
    const otherCost = existingFinance?.otherCost
      ? parseFloat(String(existingFinance.otherCost)) : 0;

    const shippingFee = shipment?.shippingFee ? parseFloat(String(shipment.shippingFee)) : 0;

    const totalCost = purchaseCost + domesticShippingCost + internationalShippingCost + otherCost + shippingFee;
    const profit = ozonSettlementAmount - totalCost;
    const profitRate = ozonSettlementAmount > 0 ? profit / ozonSettlementAmount : 0;

    let record;
    if (existingFinance) {
      [record] = await db.update(orderFinance)
        .set({
          totalCost: String(totalCost),
          profit: String(profit),
          profitRate: String(profitRate),
          updatedAt: new Date(),
        })
        .where(eq(orderFinance.orderId, orderId))
        .returning();
    } else {
      [record] = await db.insert(orderFinance)
        .values({
          orderId,
          shopId: order.shopId,
          ozonSettlementAmount: String(ozonSettlementAmount),
          totalCost: String(totalCost),
          profit: String(profit),
          profitRate: String(profitRate),
        })
        .returning();
    }

    return { success: true, data: record };
  } catch (error) {
    console.error('[Finance] calculateFinance error:', error);
    return { success: false, error: String(error) };
  }
}

export async function calculateFinanceBatch(orderIds: string[]) {
  const results = await Promise.all(orderIds.map(id => calculateFinance(id)));
  return results;
}
