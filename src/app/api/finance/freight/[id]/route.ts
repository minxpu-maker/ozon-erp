import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { shipmentRecords } from '@/storage/database/shared/fulfillment';
import { eq } from 'drizzle-orm';

/**
 * PATCH /api/finance/freight/[id]
 * 更新实际运费
 * Body: { actualFreight: number }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { actualFreight } = body;

    if (actualFreight === undefined || actualFreight === null) {
      return NextResponse.json({ success: false, error: '缺少实际运费字段' }, { status: 400 });
    }

    const [updated] = await db.update(shipmentRecords)
      .set({
        actualShippingFee: actualFreight,
        updatedAt: new Date(),
      })
      .where(eq(shipmentRecords.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ success: false, error: '记录不存在' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('更新运费失败:', error);
    return NextResponse.json({ success: false, error: '更新失败' }, { status: 500 });
  }
}
