import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { collectionItems } from '@/storage/database/shared/schema';
import { eq, inArray } from 'drizzle-orm';

/**
 * POST /api/collection-items/batch-claim
 * 批量认领采集箱条目
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { itemIds, shopId, warehouseId, userId } = body;
    
    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return NextResponse.json(
        { success: false, error: '缺少itemIds' },
        { status: 400 }
      );
    }
    
    // 更新为已认领状态（只更新pending状态的）
    const result = await db
      .update(collectionItems)
      .set({
        status: 'claimed',
        claimedAt: new Date(),
        claimedBy: userId || 'system',
        shopId,
        warehouseId,
        updatedAt: new Date(),
      })
      .where(
        inArray(collectionItems.id, itemIds) && 
        eq(collectionItems.status, 'pending')
      )
      .returning({ id: collectionItems.id });
    
    return NextResponse.json({
      success: true,
      data: {
        claimedCount: result.length,
        itemIds: result.map(r => r.id),
      },
    });
  } catch (error) {
    console.error('批量认领失败:', error);
    return NextResponse.json(
      { success: false, error: '批量认领失败' },
      { status: 500 }
    );
  }
}
