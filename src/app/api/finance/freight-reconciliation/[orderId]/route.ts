/**
 * 标记运费已核对API
 * PATCH /api/finance/freight-reconciliation/[orderId]
 * 
 * 标记指定订单的运费已核对
 */
import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/storage/database/client';
import { ozonOrders, orderFinance } from '@/storage/database/shared/fulfillment';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;
    const orderIdNum = parseInt(orderId);
    
    if (isNaN(orderIdNum)) {
      return NextResponse.json(
        { success: false, error: '无效的订单ID' },
        { status: 400 }
      );
    }
    
    const body = await request.json();
    const { reconciled } = body;
    
    // 验证参数
    if (typeof reconciled !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'reconciled参数必填且为布尔值' },
        { status: 400 }
      );
    }
    
    console.log(`[FreightReconciliation/Mark] 标记订单 ${orderIdNum}: reconciled=${reconciled}`);
    
    // 1. 验证订单存在
    const [order] = await db
      .select()
      .from(ozonOrders)
      .where(eq(ozonOrders.id, orderIdNum))
      .limit(1);
    
    if (!order) {
      return NextResponse.json(
        { success: false, error: '订单不存在' },
        { status: 404 }
      );
    }
    
    // 2. 验证财务记录存在
    const [finance] = await db
      .select()
      .from(orderFinance)
      .where(eq(orderFinance.orderId, orderIdNum))
      .limit(1);
    
    if (!finance) {
      return NextResponse.json(
        { success: false, error: '财务记录不存在' },
        { status: 404 }
      );
    }
    
    // 3. 验证已有物流账单金额
    if (finance.logisticsBillAmount === null || finance.logisticsBillAmount === '') {
      return NextResponse.json(
        { success: false, error: '请先录入物流账单金额后再标记核对' },
        { status: 400 }
      );
    }
    
    // 4. 更新核对状态（freightReconciled是integer类型）
    const reconciledValue = reconciled ? 1 : 0;
    await db
      .update(orderFinance)
      .set({
        freightReconciled: reconciledValue,
        reconciledAt: reconciled ? new Date() : null,
        updatedAt: new Date()
      })
      .where(eq(orderFinance.orderId, orderIdNum));
    
    console.log(`[FreightReconciliation/Mark] 标记成功: orderId=${orderIdNum}, reconciled=${reconciledValue}`);
    
    return NextResponse.json({
      success: true,
      message: reconciled ? '已标记为已核对' : '已取消核对标记',
      data: {
        orderId: orderIdNum,
        freightReconciled: reconciledValue,
        reconciledAt: reconciled ? new Date() : null
      }
    });
  } catch (error) {
    console.error('[FreightReconciliation/Mark] 标记失败:', error);
    return NextResponse.json(
      { success: false, error: '标记失败' },
      { status: 500 }
    );
  }
}
