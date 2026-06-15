import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { sql } from 'drizzle-orm';

// 删除店铺监控
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 软删除：将状态改为 removed
    const result = await db.execute(sql`
      UPDATE monitor_shop
      SET status = 'removed'
      WHERE id = ${parseInt(id)}
      RETURNING id, seller_name, status
    `);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: '店铺监控不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0],
    });

  } catch (error) {
    console.error('删除店铺监控失败:', error);
    return NextResponse.json(
      { success: false, error: '删除失败' },
      { status: 500 }
    );
  }
}
