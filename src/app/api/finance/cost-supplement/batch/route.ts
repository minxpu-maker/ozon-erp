import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { orderFinance, purchaseDemands, purchaseRecords } from '@/storage/database/shared/fulfillment';
import { eq, inArray } from 'drizzle-orm';
import { calculateFinance } from '@/lib/finance-calculator';

interface SupplementItem {
  orderId: number;
  purchaseCost: number;
  shippingFee?: number;
  supplierSource?: string;
  supplierName?: string;
}

/**
 * 批量采购成本补录
 * POST /api/finance/cost-supplement/batch
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { items } = body as { items: SupplementItem[] };

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({
        success: false,
        error: '缺少items参数或items为空'
      }, { status: 400 });
    }

    // 1. 提取所有订单ID并验证
    const orderIds = items.map(item => item.orderId);
    
    // 批量查询订单是否存在，并获取shopId
    const existingFinances = await db
      .select({ 
        orderId: orderFinance.orderId,
        shopId: orderFinance.shopId 
      })
      .from(orderFinance)
      .where(inArray(orderFinance.orderId, orderIds));
    
    const shopIdMap = new Map(existingFinances.map(f => [f.orderId, f.shopId]));
    const existingOrderIds = new Set(existingFinances.map(f => f.orderId));
    const validItems = items.filter(item => existingOrderIds.has(item.orderId));
    const missingOrders = items.filter(item => !existingOrderIds.has(item.orderId)).map(i => i.orderId);

    if (validItems.length === 0) {
      return NextResponse.json({
        success: false,
        error: `所有订单不存在: ${missingOrders.join(', ')}`
      }, { status: 400 });
    }

    // 2. 批量查询purchase_demands（关联订单和采购记录）
    const purchaseDemandsList = await db
      .select({ 
        demandId: purchaseDemands.id,
        orderId: purchaseDemands.orderId 
      })
      .from(purchaseDemands)
      .where(inArray(purchaseDemands.orderId, orderIds));
    
    const demandMap = new Map(purchaseDemandsList.map(d => [d.orderId, d.demandId]));

    // 3. 批量查询purchase_records
    const demandIds = purchaseDemandsList.map(d => d.demandId);
    const existingPurchases = demandIds.length > 0 
      ? await db
          .select()
          .from(purchaseRecords)
          .where(inArray(purchaseRecords.demandId, demandIds))
      : [];
    
    const purchaseMap = new Map(existingPurchases.map(p => [p.demandId, p]));

    // 4. 批量更新purchase_records
    const updatePurchasePromises: Promise<unknown>[] = [];
    const createPurchaseData: Array<{
      demandId: number;
      shopId: string;
      purchasePrice: string;
      shippingFee: string;
      supplierSource: string;
      supplierName: string;
      purchaseStatus: string;
      orderedAt: Date;
      createdAt: Date;
      updatedAt: Date;
    }> = [];

    for (const item of validItems) {
      const demandId = demandMap.get(item.orderId);
      
      if (demandId !== undefined) {
        const existingPurchase = purchaseMap.get(demandId);
        
        if (existingPurchase) {
          // 更新现有记录
          const updateData: Record<string, unknown> = {
            purchasePrice: item.purchaseCost.toString(),
            updatedAt: new Date()
          };
          if (item.shippingFee !== undefined) {
            updateData.shippingFee = item.shippingFee.toString();
          }
          if (item.supplierSource) {
            updateData.supplierSource = item.supplierSource;
          }
          if (item.supplierName) {
            updateData.supplierName = item.supplierName;
          }
          
          updatePurchasePromises.push(
            db
              .update(purchaseRecords)
              .set(updateData)
              .where(eq(purchaseRecords.id, existingPurchase.id))
          );
        } else {
          // 需要创建新记录 - 从已查询的订单获取shopId
          const shopId = shopIdMap.get(item.orderId) || 'default';
          
          createPurchaseData.push({
            demandId,
            shopId,
            purchasePrice: item.purchaseCost.toString(),
            shippingFee: item.shippingFee?.toString() || '0',
            supplierSource: item.supplierSource || 'manual',
            supplierName: item.supplierName || '手工录入',
            purchaseStatus: 'received',
            orderedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }
      }
    }

    // 5. 执行批量更新
    if (updatePurchasePromises.length > 0) {
      await Promise.all(updatePurchasePromises);
    }
    if (createPurchaseData.length > 0) {
      await db.insert(purchaseRecords).values(createPurchaseData);
    }

    // 6. 批量更新order_finance
    const updateFinancePromises: Promise<unknown>[] = [];
    for (const item of validItems) {
      updateFinancePromises.push(
        db
          .update(orderFinance)
          .set({
            purchaseCost: item.purchaseCost.toString(),
            domesticShippingCost: item.shippingFee?.toString() || '0',
            updatedAt: new Date()
          })
          .where(eq(orderFinance.orderId, item.orderId))
      );
    }
    await Promise.all(updateFinancePromises);

    // 7. 批量重新计算利润
    const results = [];
    for (const item of validItems) {
      try {
        const result = await calculateFinance(item.orderId);
        results.push({ orderId: item.orderId, success: true, data: result });
      } catch (error) {
        results.push({ 
          orderId: item.orderId, 
          success: false, 
          error: error instanceof Error ? error.message : '计算失败' 
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: true,
      message: `处理完成：成功${successCount}笔${failureCount > 0 ? `，失败${failureCount}笔` : ''}`,
      count: validItems.length,
      successCount,
      failureCount,
      results,
      warnings: missingOrders.length > 0 ? {
        message: '以下订单不存在',
        orderIds: missingOrders
      } : undefined
    });

  } catch (error) {
    console.error('[成本补录] 批量补录失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '批量补录失败'
    }, { status: 500 });
  }
}
