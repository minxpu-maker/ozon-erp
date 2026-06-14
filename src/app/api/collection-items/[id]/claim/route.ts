import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { collectionItems } from '@/storage/database/shared/schema';
import { eq } from 'drizzle-orm';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/collection-items/[id]/claim
 * 认领采集箱条目
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { shopId, warehouseId, userId } = body;
    
    // 检查条目是否存在且状态为pending
    const [existing] = await db
      .select({ id: collectionItems.id, status: collectionItems.status })
      .from(collectionItems)
      .where(eq(collectionItems.id, parseInt(id)))
      .limit(1);
    
    if (!existing) {
      return NextResponse.json(
        { success: false, error: '条目不存在' },
        { status: 404 }
      );
    }
    
    if (existing.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: '只有待处理的条目才能认领' },
        { status: 400 }
      );
    }
    
    // 更新为已认领状态
    const [updated] = await db
      .update(collectionItems)
      .set({
        status: 'claimed',
        claimedAt: new Date(),
        claimedBy: userId || 'system',
        shopId,
        warehouseId,
        updatedAt: new Date(),
      })
      .where(eq(collectionItems.id, parseInt(id)))
      .returning();
    
    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error('认领失败:', error);
    return NextResponse.json(
      { success: false, error: '认领失败' },
      { status: 500 }
    );
  }
}
