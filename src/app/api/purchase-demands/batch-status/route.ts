import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { purchaseDemands } from '@/storage/database/shared/fulfillment';
import { orders, shops } from '@/storage/database/shared/schema';
import { eq, sql, inArray } from 'drizzle-orm';

/**
 * 计算deadline（orders.createdAt + 48小时）
 */
function calculateDeadline(orderCreatedAt: Date | null): Date | null {
  if (!orderCreatedAt) return null;
  const deadline = new Date(orderCreatedAt);
  deadline.setHours(deadline.getHours() + 48);
  return deadline;
}

/**
 * 计算urgency_level
 */
function calculateUrgencyLevel(deadline: Date | null): 'overdue' | 'today' | 'tomorrow' | 'later' {
  if (!deadline) return 'later';
  
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowEnd = new Date(todayEnd.getTime() + 24 * 60 * 60 * 1000);
  
  if (deadline < todayStart) return 'overdue';
  if (deadline < todayEnd) return 'today';
  if (deadline < tomorrowEnd) return 'tomorrow';
  return 'later';
}

/**
 * GET /api/purchase-demands/batch-status
 * 批量获取采购需求状态
 * 
 * 查询参数：
 * - ids: 逗号分隔的 demandId 列表
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get('ids') || '';
    
    // 解析ids
    const ids = idsParam
      .split(',')
      .map(id => parseInt(id.trim(), 10))
      .filter(id => !isNaN(id) && id > 0);
    
    // ids为空时返回空数组
    if (ids.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
      });
    }
    
    // 查询采购需求
    const demands = await db
      .select()
      .from(purchaseDemands)
      .where(inArray(purchaseDemands.id, ids));
    
    // 如果没有需求，返回空数组
    if (demands.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
      });
    }
    
    // 批量查询关联的订单
    const orderIds = demands.map(d => d.orderId).filter(Boolean);
    const orderData = orderIds.length > 0 ? await db
      .select()
      .from(orders)
      .where(sql`${orders.id} IN ${orderIds}`) : [];
    
    // 批量查询店铺
    const shopIds = orderData.map(o => o.shopId).filter(Boolean);
    const shopData = shopIds.length > 0 ? await db
      .select()
      .from(shops)
      .where(sql`${shops.id} IN ${shopIds}`) : [];
    
    // 组装结果并计算字段
    const result = demands.map(d => {
      const order = orderData.find(o => o.id === d.orderId);
      const shop = shopData.find(s => s.id === order?.shopId);
      
      // 计算deadline
      const deadline = calculateDeadline(order?.createdAt || null);
      
      // 计算urgency_level
      const urgencyLevel = calculateUrgencyLevel(deadline);
      
      return {
        id: d.id,
        status: d.status,
        deadline: deadline?.toISOString() || null,
        urgencyLevel: urgencyLevel,
        sourceMatchStatus: 'unmatched',
        sourceMatchCount: 0,
        orderId: d.orderId,
        sku: d.sku,
        productName: d.productName,
        quantity: d.quantity,
        priority: d.priority,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
        // 关联订单信息
        order: order ? {
          id: order.id,
          postingNumber: order.ozonPostingNumber,
          status: order.status,
          erpStatus: order.erpStatus,
          shipmentDeadline: order.shipmentDeadline,
          shopId: order.shopId,
          totalPrice: order.totalPrice,
          createdAt: order.createdAt,
          shopName: shop?.name || null,
        } : null,
      };
    });
    
    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('批量获取采购需求状态失败:', error);
    return NextResponse.json(
      { success: false, error: '批量获取状态失败' },
      { status: 500 }
    );
  }
}