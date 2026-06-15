import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { sql } from 'drizzle-orm';

// DELETE /api/monitor?id=xxx - 取消监控
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const productId = searchParams.get('productId');

    if (!id && !productId) {
      return NextResponse.json({ success: false, error: '缺少id或productId' }, { status: 400 });
    }

    if (id) {
      await db.execute(sql`DELETE FROM product_monitor WHERE id = ${parseInt(id)}`);
    } else if (productId) {
      await db.execute(sql`DELETE FROM product_monitor WHERE product_id = ${productId}`);
    }

    return NextResponse.json({ success: true, message: '已取消监控' });
  } catch (error) {
    console.error('取消监控失败:', error);
    return NextResponse.json({ success: false, error: '取消监控失败' }, { status: 500 });
  }
}
