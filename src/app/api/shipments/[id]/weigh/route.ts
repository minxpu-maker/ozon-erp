import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { shipmentRecords } from '@/storage/database/shared/fulfillment';
import { orders } from '@/storage/database/shared/schema';
import { eq } from 'drizzle-orm';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { packageWeight, packageLength, packageWidth, packageHeight } = body;

    if (!packageWeight) {
      return NextResponse.json({ error: 'packageWeight 为必填' }, { status: 400 });
    }

    // 查shipment记录是否存在
    const [record] = await db.select().from(shipmentRecords)
      .where(eq(shipmentRecords.id, id));

    if (!record) {
      return NextResponse.json({ error: '发货记录不存在' }, { status: 404 });
    }

    // 更新重量和尺寸
    const [updated] = await db.update(shipmentRecords)
      .set({
        packageWeight: packageWeight,
        packageLength: packageLength || null,
        packageWidth: packageWidth || null,
        packageHeight: packageHeight || null,
        updatedAt: new Date(),
      })
      .where(eq(shipmentRecords.id, id))
      .returning();

    // 同步更新orders表的package_weight
    await db.update(orders)
      .set({ packageWeight: packageWeight })
      .where(eq(orders.id, record.orderId));

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('[Weigh] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
