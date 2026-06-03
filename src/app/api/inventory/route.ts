import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import * as schema from '@/storage/database/shared/schema';
import { eq } from 'drizzle-orm';

// 获取库存列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const skuId = searchParams.get('skuId');

    let inventory;
    if (skuId) {
      inventory = await db.select().from(schema.inventory)
        .where(eq(schema.inventory.sku_id, skuId));
    } else {
      inventory = await db.select().from(schema.inventory);
    }

    return NextResponse.json({ success: true, data: inventory });
  } catch (error) {
    console.error('获取库存失败:', error);
    return NextResponse.json({ success: false, error: '获取库存失败' }, { status: 500 });
  }
}

// 更新库存
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { skuId, warehouseId, quantity, reservedQuantity } = body;

    // 检查是否已存在库存记录
    const [existing] = await db.select().from(schema.inventory)
      .where(eq(schema.inventory.sku_id, skuId));

    if (existing) {
      // 更新库存
      const [updated] = await db.update(schema.inventory)
        .set({ 
          quantity: quantity ?? existing.quantity,
          reserved_quantity: reservedQuantity ?? existing.reserved_quantity,
          updated_at: new Date(),
        })
        .where(eq(schema.inventory.sku_id, skuId))
        .returning();

      return NextResponse.json({ success: true, data: updated, message: '库存更新成功' });
    } else {
      // 创建库存记录
      const [created] = await db.insert(schema.inventory).values({
        sku_id: skuId,
        warehouse_id: warehouseId || null,
        quantity: quantity || 0,
        reserved_quantity: reservedQuantity || 0,
      }).returning();

      return NextResponse.json({ success: true, data: created, message: '库存创建成功' });
    }
  } catch (error) {
    console.error('更新库存失败:', error);
    return NextResponse.json({ success: false, error: '更新库存失败' }, { status: 500 });
  }
}
