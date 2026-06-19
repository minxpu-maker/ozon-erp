/**
 * 删除店铺 API
 * DELETE /api/shops/[id]
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { shops } from '@/storage/database/shared/schema';
import { eq } from 'drizzle-orm';

/**
 * DELETE /api/shops/[id]
 * 删除指定店铺
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: '店铺ID不能为空' },
        { status: 400 }
      );
    }

    // 删除店铺
    const result = await db
      .delete(shops)
      .where(eq(shops.id, id))
      .returning();

    if (result.length === 0) {
      return NextResponse.json(
        { success: false, error: '店铺不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '店铺已删除',
    });
  } catch (error) {
    console.error('[Shops API] DELETE error:', error);
    return NextResponse.json(
      { success: false, error: '删除店铺失败' },
      { status: 500 }
    );
  }
}
