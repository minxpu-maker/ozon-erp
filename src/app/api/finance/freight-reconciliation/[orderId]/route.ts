/**
 * 标记运费已核对API
 * PATCH /api/finance/freight-reconciliation/[orderId]
 */
import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/storage/database/client';
import { orders, orderFinance } from '@/storage/database/shared/schema';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;
    const body = await request.json();
    const { reconciled } = body;

    if (typeof reconciled !== 'boolean') {
      return NextResponse.json({ success: false, error: 'reconciled参数必填' }, { status: 400 });
    }

    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order) {
      return NextResponse.json({ success: false, error: '订单不存在' }, { status: 404 });
    }

    const [finance] = await db
      .select().from(orderFinance)
      .where(eq(orderFinance.orderId, orderId)).limit(1);
    if (!finance) {
      return NextResponse.json({ success: false, error: '财务记录不存在' }, { status: 404 });
    }

    await db.update(orderFinance)
      .set({
        freightReconciled: reconciled,
        reconciledAt: reconciled ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(orderFinance.orderId, orderId));

    return NextResponse.json({
      success: true,
      message: reconciled ? '已标记为已核对' : '已取消核对标记',
    });
  } catch (error) {
    console.error('[FreightReconciliation] error:', error);
    return NextResponse.json({ success: false, error: '标记失败' }, { status: 500 });
  }
}
