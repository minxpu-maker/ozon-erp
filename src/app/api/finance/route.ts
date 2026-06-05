import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import * as schema from '@/storage/database/shared/schema';
import { eq, desc } from 'drizzle-orm';
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
  currency: string;
  products: FinancialDetail[];
  accrualsDetails?: Array<{ // 应计费用明细
    type: string;
    typeName: string;
    amount: number;
    currency: string;
  }>;
}

// 从订单raw_data中提取财务明细
function extractFinancialData(order: any): OrderFinancialData | null {
  const financialData = order.ozon_raw_data?.financial_data;
  if (!financialData) return null;

  const products: FinancialDetail[] = [];
  let totalCommission = 0;
  let totalPayout = 0;
  let totalDiscount = 0;
  let totalRevenue = 0;

  // 从products数组提取每个商品的财务数据
  const rawProducts = financialData.products || [];
  const orderProducts = order.ozon_raw_data?.products || [];

  for (const fp of rawProducts) {
    // 找到对应的商品信息
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

  // 从 ozon_raw_data 中提取应计费用（如果有）
  let acquiringFee = 0;
  let otherFees = 0;
  const accrualsDetails: Array<{
    type: string;
    typeName: string;
    amount: number;
    currency: string;
  }> = [];

  // 检查是否有应计费用数据
  const accruals = order.ozon_raw_data?.accruals || [];
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

  return {
    ozonOrderId: order.ozon_order_id,
    postingNumber: order.ozon_posting_number,
    buyerName: order.buyer_name,
    status: order.status,
    totalRevenue,
    totalCommission,
    totalPayout,
    totalDiscount,
    acquiringFee,
    otherFees,
    currency: 'RUB',
    products,
    accrualsDetails: accrualsDetails.length > 0 ? accrualsDetails : undefined,
  };
}

// 获取Ozon应计费用（收单业务费用）
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

// 获取财务核算列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const shopId = searchParams.get('shopId');
    const withAccruals = searchParams.get('withAccruals') === 'true';

    // 获取未结算的订单
    const orders = await db.select().from(schema.orders)
      .where(eq(schema.orders.is_settled, false))
      .orderBy(desc(schema.orders.created_at));

    // 提取财务明细
    const pendingOrdersWithFinancials = await Promise.all(
      orders.map(async (order) => {
        const financialData = extractFinancialData(order);
        
        // 如果订单有posting_number且需要获取应计费用
        if (order.ozon_posting_number && (withAccruals || !financialData?.acquiringFee)) {
          try {
            const accruals = await fetchOrderAccruals(order.ozon_posting_number);
            if (financialData) {
              financialData.acquiringFee = accruals.acquiringFee;
              financialData.otherFees = accruals.otherFees;
              financialData.accrualsDetails = accruals.details;
            }
          } catch (e) {
            console.error('[Finance API] Failed to get accruals for order:', order.ozon_posting_number, e);
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

    // 计算统计信息
    const stats = {
      totalOrders: pendingOrdersWithFinancials.length,
      totalRevenue: pendingOrdersWithFinancials.reduce((sum, o) => sum + (o.financialData?.totalRevenue || 0), 0),
      totalCommission: pendingOrdersWithFinancials.reduce((sum, o) => sum + (o.financialData?.totalCommission || 0), 0),
      totalPayout: pendingOrdersWithFinancials.reduce((sum, o) => sum + (o.financialData?.totalPayout || 0), 0),
      totalDiscount: pendingOrdersWithFinancials.reduce((sum, o) => sum + (o.financialData?.totalDiscount || 0), 0),
      totalAcquiringFee: pendingOrdersWithFinancials.reduce((sum, o) => sum + (o.financialData?.acquiringFee || 0), 0),
    };

    return NextResponse.json({ 
      success: true, 
      data: { 
        pendingOrders: pendingOrdersWithFinancials,
        settledRecords: records,
        stats,
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

    // 获取订单
    const [order] = await db.select().from(schema.orders)
      .where(eq(schema.orders.id, orderId));

    if (!order) {
      return NextResponse.json({ success: false, error: '订单不存在' }, { status: 404 });
    }

    // 提取财务明细
    const financialData = extractFinancialData(order);
    
    // 获取应计费用
    let acquiringFee = 0;
    if (order.ozon_posting_number) {
      try {
        const accruals = await fetchOrderAccruals(order.ozon_posting_number);
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

    // 获取采购成本
    const purchaseTasks = await db.select().from(schema.purchaseTasks)
      .where(eq(schema.purchaseTasks.order_id, orderId));

    let purchaseCost = 0;
    let shippingFee = 0;
    for (const task of purchaseTasks) {
      purchaseCost += parseFloat(task.purchase_amount || '0');
      shippingFee += parseFloat(task.shipping_fee || '0');
    }

    // 计算利润
    const revenue = financialData?.totalRevenue || parseFloat(order.total_price || '0');
    const commission = financialData?.totalCommission || 0;
    // 净利润 = 收入 - 佣金 - 收单费 - 采购成本 - 运费
    const grossProfit = revenue - commission - acquiringFee - purchaseCost;
    const netProfit = grossProfit - shippingFee;

    // 保存利润记录
    await db.insert(schema.financeRecords).values({
      order_id: orderId,
      ozon_settlement_amount: revenue.toString(),
      purchase_cost: purchaseCost.toString(),
      domestic_shipping_cost: shippingFee.toString(),
      package_cost: '0',
      ozon_commission: commission.toString(),
      other_cost: acquiringFee.toString(), // 收单费存入other_cost
      after_sale_loss: '0',
      gross_profit: grossProfit.toString(),
      net_profit: netProfit.toString(),
      is_settled: true,
      settled_at: new Date(),
    });

    // 更新订单结算状态
    await db
      .update(schema.orders)
      .set({ is_settled: true, settled_at: new Date() })
      .where(eq(schema.orders.id, orderId));

    return NextResponse.json({
      success: true,
      data: { 
        revenue, 
        commission,
        acquiringFee,
        purchaseCost, 
        shippingFee,
        grossProfit, 
        netProfit,
        financialData,
      },
      message: '利润核算完成',
    });
  } catch (error) {
    console.error('利润核算失败:', error);
    return NextResponse.json({ success: false, error: '利润核算失败' }, { status: 500 });
  }
}
