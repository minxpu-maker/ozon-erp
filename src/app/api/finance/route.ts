import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import * as schema from '@/storage/database/shared/schema';
import { eq, desc, and, gte, lte } from 'drizzle-orm';
import { createOzonClient } from '@/lib/ozon/client';

// 财务明细类型定义
interface FinancialDetail {
  productId: number;
  productName: string;
  quantity: number;
  price: number; // 商品单价
  customerPrice: number; // 客户实际支付
  commissionAmount: number; // 平台佣金
  commissionPercent: number; // 佣金百分比
  payout: number; // 实际结算金额
  totalDiscountValue: number; // 折扣金额
  totalDiscountPercent: number; // 折扣百分比
  oldPrice: number; // 原价
  currencyCode: string;
}

interface OrderFinancialData {
  ozonOrderId: string;
  postingNumber: string;
  buyerName: string;
  status: string;
  totalRevenue: number; // 总收入（客户支付）
  totalCommission: number; // 总佣金
  totalPayout: number; // 总结算金额
  totalDiscount: number; // 总折扣
  acquiringFee: number; // 收单业务费用
  otherFees: number; // 其他费用
  purchasePrice: number; // 采购价（人民币）
  estimatedProfit: number; // 预估利润
  profitRate: number; // 利润率 (%)
  currency: string;
  products: FinancialDetail[];
  accrualsDetails?: Array<{
    type: string;
    typeName: string;
    amount: number;
    currency: string;
  }>;
}

// 从订单raw_data中提取财务明细
function extractFinancialData(order: any, rubToCny: number = 0.08): OrderFinancialData | null {
  const financialData = order.ozonRawData?.financial_data;
  
  const products: FinancialDetail[] = [];
  let totalCommission = 0;
  let totalPayout = 0;
  let totalDiscount = 0;
  let totalRevenue = 0;

  // 从products数组提取每个商品的财务数据
  const rawProducts = financialData?.products || [];
  const orderProducts = order.ozonRawData?.products || [];

  for (const fp of rawProducts) {
    const productInfo = orderProducts.find((p: any) => p.product_id === fp.product_id || p.sku === fp.product_id);

    const detail: FinancialDetail = {
      productId: fp.product_id,
      productName: productInfo?.name || `商品${fp.product_id}`,
      quantity: fp.quantity || 1,
      price: fp.price || 0,
      customerPrice: fp.customer_price || 0,
      commissionAmount: fp.commission_amount || 0,
      commissionPercent: fp.commission_percent || 0,
      payout: fp.payout || 0,
      totalDiscountValue: fp.total_discount_value || 0,
      totalDiscountPercent: fp.total_discount_percent || 0,
      oldPrice: fp.old_price || fp.price || 0,
      currencyCode: fp.currency_code || 'RUB',
    };

    products.push(detail);
    totalCommission += detail.commissionAmount * detail.quantity;
    totalPayout += detail.payout;
    totalDiscount += detail.totalDiscountValue * detail.quantity;
    totalRevenue += detail.customerPrice * detail.quantity;
  }

  // 如果没有financial_data，使用total_price作为收入
  if (totalRevenue === 0 && order.totalPrice) {
    totalRevenue = parseFloat(order.totalPrice);
  }

  // 提取应计费用
  let acquiringFee = 0;
  let otherFees = 0;
  const accrualsDetails: Array<{
    type: string;
    typeName: string;
    amount: number;
    currency: string;
  }> = [];

  const syncAccruals = order.ozonRawData?._accruals;
  if (syncAccruals) {
    acquiringFee = syncAccruals.acquiringFee || 0;
    otherFees = syncAccruals.otherFees || 0;
  } else {
    const accruals = order.ozonRawData?.accruals || [];
    for (const acc of accruals) {
      const amount = Math.abs(parseFloat(acc.amount || '0'));
      if (acc.type === 'acquiring' || acc.typeName?.includes('收单')) {
        acquiringFee += amount;
      } else {
        otherFees += amount;
      }
      accrualsDetails.push({
        type: acc.type || '',
        typeName: acc.typeName || '',
        amount: parseFloat(acc.amount || '0'),
        currency: acc.currency || 'RUB',
      });
    }
  }

  // 计算采购价和利润
  const purchasePrice = order.purchasePrice || 0;
  const revenueCNY = totalRevenue * rubToCny; // 转换为人民币
  const commissionCNY = totalCommission * rubToCny;
  const acquiringFeeCNY = acquiringFee * rubToCny;
  
  // 预估利润 = 收入 - 佣金 - 收单费 - 采购成本
  const estimatedProfit = revenueCNY - commissionCNY - acquiringFeeCNY - purchasePrice;
  
  // 利润率 = 利润 / 收入 * 100
  const profitRate = revenueCNY > 0 ? (estimatedProfit / revenueCNY) * 100 : 0;

  return {
    ozonOrderId: order.ozonOrderId,
    postingNumber: order.ozonPostingNumber,
    buyerName: order.buyerName,
    status: order.status,
    totalRevenue,
    totalCommission,
    totalPayout,
    totalDiscount,
    acquiringFee,
    otherFees,
    purchasePrice,
    estimatedProfit,
    profitRate,
    currency: 'RUB',
    products,
    accrualsDetails: accrualsDetails.length > 0 ? accrualsDetails : undefined,
  };
}

// 获取Ozon应计费用
async function fetchOrderAccruals(postingNumber: string): Promise<{
  acquiringFee: number;
  otherFees: number;
  details: Array<{
    type: string;
    typeName: string;
    amount: number;
    currency: string;
  }>;
}> {
  try {
    const ozon = createOzonClient();
    return await ozon.getOrderAccruals(postingNumber);
  } catch (error) {
    console.error('[Finance API] Failed to fetch accruals:', error);
    return { acquiringFee: 0, otherFees: 0, details: [] };
  }
}

// 计算日期汇总
function calculateDateSummaries(orders: any[], rubToCny: number) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const summaries = {
    daily: { orders: 0, revenue: 0, profit: 0, profitRate: 0 },
    weekly: { orders: 0, revenue: 0, profit: 0, profitRate: 0 },
    monthly: { orders: 0, revenue: 0, profit: 0, profitRate: 0 },
    yearly: { orders: 0, revenue: 0, profit: 0, profitRate: 0 },
  };

  for (const order of orders) {
    const orderDate = new Date(order.ozon_created_at || order.createdAt);
    const fd = extractFinancialData(order, rubToCny);
    if (!fd) continue;

    const revenue = fd.totalRevenue * rubToCny;
    const profit = fd.estimatedProfit;

    // 日汇总
    if (orderDate >= today) {
      summaries.daily.orders++;
      summaries.daily.revenue += revenue;
      summaries.daily.profit += profit;
    }

    // 周汇总
    if (orderDate >= weekStart) {
      summaries.weekly.orders++;
      summaries.weekly.revenue += revenue;
      summaries.weekly.profit += profit;
    }

    // 月汇总
    if (orderDate >= monthStart) {
      summaries.monthly.orders++;
      summaries.monthly.revenue += revenue;
      summaries.monthly.profit += profit;
    }

    // 年汇总
    if (orderDate >= yearStart) {
      summaries.yearly.orders++;
      summaries.yearly.revenue += revenue;
      summaries.yearly.profit += profit;
    }
  }

  // 计算利润率
  if (summaries.daily.revenue > 0) summaries.daily.profitRate = (summaries.daily.profit / summaries.daily.revenue) * 100;
  if (summaries.weekly.revenue > 0) summaries.weekly.profitRate = (summaries.weekly.profit / summaries.weekly.revenue) * 100;
  if (summaries.monthly.revenue > 0) summaries.monthly.profitRate = (summaries.monthly.profit / summaries.monthly.revenue) * 100;
  if (summaries.yearly.revenue > 0) summaries.yearly.profitRate = (summaries.yearly.profit / summaries.yearly.revenue) * 100;

  return summaries;
}

// 获取财务核算列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const withAccruals = searchParams.get('withAccruals') === 'true';

    // 获取汇率
    let rubToCny = 0.08;
    try {
      const rateRes = await fetch(`${process.env.Coze_PROJECT_DOMAIN_DEFAULT || 'http://localhost:5000'}/api/exchange-rate`);
      const rateData = await rateRes.json();
      if (rateData.success && rateData.data?.rate) {
        rubToCny = rateData.data.rate;
      }
    } catch (e) {
      console.error('[Finance API] Failed to get exchange rate:', e);
    }

    // 获取未结算的订单
    const orders = await db.select().from(schema.orders)
      .where(eq(schema.orders.isSettled, false))
      .orderBy(desc(schema.orders.createdAt));

    // 提取财务明细
    const pendingOrdersWithFinancials = await Promise.all(
      orders.map(async (order) => {
        const financialData = extractFinancialData(order, rubToCny);
        
        if (order.ozonPostingNumber && (withAccruals || !financialData?.acquiringFee)) {
          try {
            const accruals = await fetchOrderAccruals(order.ozonPostingNumber);
            if (financialData) {
              financialData.acquiringFee = accruals.acquiringFee;
              financialData.otherFees = accruals.otherFees;
              financialData.accrualsDetails = accruals.details;
            }
          } catch (e) {
            console.error('[Finance API] Failed to get accruals for order:', order.ozonPostingNumber, e);
          }
        }
        
        return {
          ...order,
          financialData,
        };
      })
    );

    // 获取已结算的财务记录
    const records = await db.select().from(schema.financeRecords)
      .orderBy(desc(schema.financeRecords.settled_at));

    // 获取所有订单（用于日期汇总）
    const allOrders = await db.select().from(schema.orders).orderBy(desc(schema.orders.createdAt));
    const dateSummaries = calculateDateSummaries(allOrders, rubToCny);

    // 计算统计信息
    const stats = {
      totalOrders: pendingOrdersWithFinancials.length,
      totalRevenue: pendingOrdersWithFinancials.reduce((sum, o) => sum + (o.financialData?.totalRevenue || 0) * rubToCny, 0),
      totalCommission: pendingOrdersWithFinancials.reduce((sum, o) => sum + (o.financialData?.totalCommission || 0) * rubToCny, 0),
      totalPayout: pendingOrdersWithFinancials.reduce((sum, o) => sum + (o.financialData?.totalPayout || 0) * rubToCny, 0),
      totalDiscount: pendingOrdersWithFinancials.reduce((sum, o) => sum + (o.financialData?.totalDiscount || 0) * rubToCny, 0),
      totalAcquiringFee: pendingOrdersWithFinancials.reduce((sum, o) => sum + (o.financialData?.acquiringFee || 0) * rubToCny, 0),
      totalPurchasePrice: pendingOrdersWithFinancials.reduce((sum, o) => sum + (o.financialData?.purchasePrice || 0), 0),
      totalEstimatedProfit: pendingOrdersWithFinancials.reduce((sum, o) => sum + (o.financialData?.estimatedProfit || 0), 0),
    };

    return NextResponse.json({ 
      success: true, 
      data: { 
        pendingOrders: pendingOrdersWithFinancials,
        settledRecords: records,
        stats,
        dateSummaries,
        exchangeRate: rubToCny,
      } 
    });
  } catch (error) {
    console.error('获取财务数据失败:', error);
    return NextResponse.json({ success: false, error: '获取财务数据失败' }, { status: 500 });
  }
}

// 执行利润核算
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId } = body;

    const [order] = await db.select().from(schema.orders)
      .where(eq(schema.orders.id, orderId));

    if (!order) {
      return NextResponse.json({ success: false, error: '订单不存在' }, { status: 404 });
    }

    // 获取汇率
    let rubToCny = 0.08;
    try {
      const rateRes = await fetch(`${process.env.Coze_PROJECT_DOMAIN_DEFAULT || 'http://localhost:5000'}/api/exchange-rate`);
      const rateData = await rateRes.json();
      if (rateData.success && rateData.data?.rate) {
        rubToCny = rateData.data.rate;
      }
    } catch (e) {
      console.error('[Finance API] Failed to get exchange rate:', e);
    }

    const financialData = extractFinancialData(order, rubToCny);
    
    let acquiringFee = 0;
    if (order.ozonPostingNumber) {
      try {
        const accruals = await fetchOrderAccruals(order.ozonPostingNumber);
        acquiringFee = accruals.acquiringFee;
        if (financialData) {
          financialData.acquiringFee = accruals.acquiringFee;
          financialData.otherFees = accruals.otherFees;
          financialData.accrualsDetails = accruals.details;
        }
      } catch (e) {
        console.error('[Finance API] Failed to get accruals:', e);
      }
    }

    // 使用订单中的采购价
    const purchaseCost = parseFloat(order.purchasePrice || '0');
    const shippingFee = 0;

    const revenue = (financialData?.totalRevenue || parseFloat(order.totalPrice || '0')) * rubToCny;
    const commission = (financialData?.totalCommission || 0) * rubToCny;
    const acquiringFeeCNY = acquiringFee * rubToCny;
    
    const grossProfit = revenue - commission - acquiringFeeCNY - purchaseCost;
    const netProfit = grossProfit - shippingFee;

    await db.insert(schema.financeRecords).values({
      order_id: orderId,
      ozon_settlement_amount: (financialData?.totalRevenue || 0).toString(),
      purchase_cost: purchaseCost.toString(),
      domestic_shipping_cost: shippingFee.toString(),
      package_cost: '0',
      ozon_commission: (financialData?.totalCommission || 0).toString(),
      other_cost: acquiringFee.toString(),
      after_sale_loss: '0',
      gross_profit: grossProfit.toString(),
      net_profit: netProfit.toString(),
      is_settled: true,
      settled_at: new Date(),
    });

    await db
      .update(schema.orders)
      .set({ isSettled: true, settledAt: new Date() })
      .where(eq(schema.orders.id, orderId));

    return NextResponse.json({
      success: true,
      data: { 
        revenue, 
        commission,
        acquiringFee: acquiringFeeCNY,
        purchaseCost, 
        shippingFee,
        grossProfit, 
        netProfit,
        profitRate: revenue > 0 ? (netProfit / revenue) * 100 : 0,
        financialData,
      },
      message: '利润核算完成',
    });
  } catch (error) {
    console.error('利润核算失败:', error);
    return NextResponse.json({ success: false, error: '利润核算失败' }, { status: 500 });
  }
}
