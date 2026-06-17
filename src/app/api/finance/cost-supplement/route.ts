/**
 * 采购成本补录API（单条）
 * POST /api/finance/cost-supplement
 * 
 * 补录采购成本，更新purchase_records，并重新计算利润
 */
import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/storage/database/client';
import { ozonOrders, purchaseRecords, orderFinance } from '@/storage/database/shared/fulfillment';
import { calculateFinance } from '@/lib/finance-calculator';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { purchaseRecordId, orderId, purchaseCost, shippingFee, supplierSource, supplierName } = body;
    
    // 验证必填参数：purchaseRecordId 或 orderId 二选一
    if (!purchaseRecordId && !orderId) {
      return NextResponse.json(
        { success: false, error: 'purchaseRecordId或orderId必填其一' },
        { status: 400 }
      );
    }
    
    if (purchaseCost === undefined || purchaseCost === null || isNaN(parseFloat(purchaseCost))) {
      return NextResponse.json(
        { success: false, error: 'purchaseCost必填且为有效金额' },
        { status: 400 }
      );
    }
    
    const purchaseCostNum = parseFloat(purchaseCost);
    const shippingFeeNum = shippingFee !== undefined && !isNaN(parseFloat(shippingFee)) 
      ? parseFloat(shippingFee) 
      : null;
    
    let targetPurchaseRecordId: number | null = purchaseRecordId ? parseInt(String(purchaseRecordId)) : null;
    let targetOrderId: number | null = orderId ? parseInt(String(orderId)) : null;
    
    // 1. 如果有purchaseRecordId，直接使用
    if (targetPurchaseRecordId) {
      const [existingPurchase] = await db
        .select()
        .from(purchaseRecords)
        .where(eq(purchaseRecords.id, targetPurchaseRecordId))
        .limit(1);
      
      if (!existingPurchase) {
        return NextResponse.json(
          { success: false, error: '采购记录不存在' },
          { status: 404 }
        );
      }
      
      console.log(`[CostSupplement] 使用purchaseRecordId ${targetPurchaseRecordId} 补录`);
      
      // 2. 更新purchase_records
      const updateData: Record<string, unknown> = {
        purchasePrice: purchaseCostNum.toString(),
        updatedAt: new Date()
      };
      
      if (shippingFeeNum !== null) {
        updateData.shippingFee = shippingFeeNum.toString();
      }
      
      if (supplierSource) {
        updateData.supplierSource = supplierSource;
      }
      
      if (supplierName) {
        updateData.supplierName = supplierName;
      }
      
      await db
        .update(purchaseRecords)
        .set(updateData)
        .where(eq(purchaseRecords.id, targetPurchaseRecordId));
      
      console.log(`[CostSupplement] 更新purchase_records ${targetPurchaseRecordId} 成功`);
      
      // 3. 通过purchase_records的ozonOrderIds更新所有关联的order_finance
      const ozonOrderIds = existingPurchase.ozonOrderIds as number[] | null;
      
      if (ozonOrderIds && ozonOrderIds.length > 0) {
        // 更新每个关联订单的order_finance
        for (const relatedOrderId of ozonOrderIds) {
          await updateOrderFinance(relatedOrderId, purchaseCostNum, shippingFeeNum);
        }
      }
      
      return NextResponse.json({
        success: true,
        message: '补录成功',
        data: {
          purchaseRecordId: targetPurchaseRecordId,
          relatedOrders: ozonOrderIds || [],
          purchaseCost: purchaseCostNum,
          shippingFee: shippingFeeNum
        }
      });
    }
    
    // 2. 如果只有orderId，通过ozonOrderIds字段查找对应的purchase_record
    if (targetOrderId) {
      // 查找包含此orderId的purchase_records
      // 由于ozonOrderIds是JSON数组，需要使用SQL查询
      const { sql } = await import('drizzle-orm');
      
      const purchases = await db.execute(
        sql`SELECT * FROM purchase_records WHERE ozon_order_ids @> ${JSON.stringify([targetOrderId])} LIMIT 1`
      );
      
      const rows = purchases.rows as Array<{
        id: number;
        ozonOrderIds: number[] | null;
        purchasePrice: string | null;
      }>;
      
      if (rows.length === 0) {
        // 没有找到采购记录，创建一个新的
        // 注意：创建时需要demandId，这里暂时用0代替
        return NextResponse.json(
          { success: false, error: '未找到关联的采购记录，请提供purchaseRecordId' },
          { status: 400 }
        );
      }
      
      const existingPurchase = rows[0];
      targetPurchaseRecordId = existingPurchase.id;
      
      console.log(`[CostSupplement] 通过orderId ${targetOrderId} 找到purchaseRecordId ${targetPurchaseRecordId}`);
      
      // 更新purchase_records
      const updateData: Record<string, unknown> = {
        purchasePrice: purchaseCostNum.toString(),
        updatedAt: new Date()
      };
      
      if (shippingFeeNum !== null) {
        updateData.shippingFee = shippingFeeNum.toString();
      }
      
      if (supplierSource) {
        updateData.supplierSource = supplierSource;
      }
      
      if (supplierName) {
        updateData.supplierName = supplierName;
      }
      
      await db
        .update(purchaseRecords)
        .set(updateData)
        .where(eq(purchaseRecords.id, targetPurchaseRecordId));
      
      // 更新orderId对应的order_finance
      await updateOrderFinance(targetOrderId, purchaseCostNum, shippingFeeNum);
      
      return NextResponse.json({
        success: true,
        message: '补录成功',
        data: {
          purchaseRecordId: targetPurchaseRecordId,
          orderId: targetOrderId,
          purchaseCost: purchaseCostNum,
          shippingFee: shippingFeeNum
        }
      });
    }
    
    return NextResponse.json(
      { success: false, error: '参数错误' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[CostSupplement] 补录失败:', error);
    return NextResponse.json(
      { success: false, error: '补录失败: ' + String(error) },
      { status: 500 }
    );
  }
}

/**
 * 更新订单财务数据
 */
async function updateOrderFinance(
  orderId: number,
  purchaseCost: number,
  shippingFee: number | null
) {
  // 检查order_finance是否存在
  const [existingFinance] = await db
    .select()
    .from(orderFinance)
    .where(eq(orderFinance.orderId, orderId))
    .limit(1);
  
  const financeData: Record<string, unknown> = {
    purchaseCost: purchaseCost.toString(),
    updatedAt: new Date()
  };
  
  if (shippingFee !== null) {
    financeData.domesticShippingCost = shippingFee.toString();
  }
  
  if (existingFinance) {
    await db
      .update(orderFinance)
      .set(financeData)
      .where(eq(orderFinance.orderId, orderId));
  } else {
    // 获取订单信息用于创建
    const [order] = await db
      .select()
      .from(ozonOrders)
      .where(eq(ozonOrders.id, orderId))
      .limit(1);
    
    if (order) {
      await db.insert(orderFinance).values({
        shopId: order.shopId,
        orderId: orderId,
        purchaseCost: purchaseCost.toString(),
        domesticShippingCost: shippingFee?.toString() ?? '0',
        status: 'estimated',
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
  }
  
  console.log(`[CostSupplement] 更新order_finance orderId=${orderId}`);
  
  // 4. 重新计算利润
  await calculateFinance(orderId);
}
