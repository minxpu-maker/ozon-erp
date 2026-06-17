import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { qcRecords } from '@/storage/database/shared/fulfillment';
import { orders } from '@/storage/database/shared/schema';
import { eq, and } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const expressNo = searchParams.get('expressNo');
  const ozonOrderId = searchParams.get('ozonOrderId');
  const qcResult = searchParams.get('qcResult');
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');

  const conditions = [];
  if (expressNo) conditions.push(eq(qcRecords.expressNo, expressNo));
  if (ozonOrderId) conditions.push(eq(qcRecords.ozonOrderId, ozonOrderId));
  if (qcResult) conditions.push(eq(qcRecords.qcResult, qcResult));

  let query = db.select().from(qcRecords);
  if (conditions.length > 0) {
    query = query.where(conditions.length === 1 ? conditions[0] : and(...conditions)) as any;
  }

  const data = await query.limit(limit).offset(offset);
  return NextResponse.json({ success: true, data, offset, limit });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { 
    expressNo, 
    ozonOrderId, 
    purchaseId, 
    qcResult, 
    actualQuantity, 
    expectedQuantity,
    checkItems,
    exceptionType,
    notes, 
    inspectedBy 
  } = body;

  if (!expressNo || !qcResult) {
    return NextResponse.json({ error: 'expressNo 和 qcResult 为必填' }, { status: 400 });
  }

  // 查是否已验过
  const existing = await db.select().from(qcRecords)
    .where(eq(qcRecords.expressNo, expressNo));
  if (existing.length > 0) {
    return NextResponse.json({ error: '该快递单号已验货' }, { status: 409 });
  }

  // 创建验货记录
  const [record] = await db.insert(qcRecords).values({
    expressNo,
    ozonOrderId: ozonOrderId || null,
    purchaseId: purchaseId || null,
    qcResult,
    quantityActual: actualQuantity || null,
    quantityExpected: expectedQuantity || null,
    checkItems: checkItems || null,
    exceptionType: exceptionType || null,
    remark: notes || null,
    operator: inspectedBy || 'system',
  }).returning();

  // 同步更新 orders 表验货状态
  if (ozonOrderId) {
    await db.update(orders)
      .set({ isInspected: true, inspectedAt: new Date() })
      .where(eq(orders.id, ozonOrderId));
  }

  return NextResponse.json({ success: true, data: record }, { status: 201 });
}
