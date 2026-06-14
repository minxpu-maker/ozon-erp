import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { collectionItems, marketSignals } from '@/storage/database/shared/schema';
import { eq } from 'drizzle-orm';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/collection-items/[id]
 * 获取单个采集箱条目详情
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    
    const [item] = await db
      .select({
        id: collectionItems.id,
        status: collectionItems.status,
        priority: collectionItems.priority,
        tags: collectionItems.tags,
        notes: collectionItems.notes,
        claimedAt: collectionItems.claimedAt,
        claimedBy: collectionItems.claimedBy,
        publishedAt: collectionItems.publishedAt,
        ozonTaskId: collectionItems.ozonTaskId,
        ozonProductId: collectionItems.ozonProductId,
        publishStatus: collectionItems.publishStatus,
        publishError: collectionItems.publishError,
        createdAt: collectionItems.createdAt,
        updatedAt: collectionItems.updatedAt,
        editedData: collectionItems.editedData,
        signal: marketSignals,
      })
      .from(collectionItems)
      .leftJoin(marketSignals, eq(collectionItems.signalId, marketSignals.id))
      .where(eq(collectionItems.id, parseInt(id)))
      .limit(1);
    
    if (!item) {
      return NextResponse.json(
        { success: false, error: '条目不存在' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: item,
    });
  } catch (error) {
    console.error('获取采集箱条目失败:', error);
    return NextResponse.json(
      { success: false, error: '获取失败' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/collection-items/[id]
 * 更新采集箱条目
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { editedData, tags, notes, priority } = body;
    
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    
    if (editedData !== undefined) {
      updateData.editedData = editedData;
    }
    if (tags !== undefined) {
      updateData.tags = tags;
    }
    if (notes !== undefined) {
      updateData.notes = notes;
    }
    if (priority !== undefined) {
      updateData.priority = priority;
    }
    
    const [updated] = await db
      .update(collectionItems)
      .set(updateData)
      .where(eq(collectionItems.id, parseInt(id)))
      .returning();
    
    if (!updated) {
      return NextResponse.json(
        { success: false, error: '条目不存在' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error('更新采集箱条目失败:', error);
    return NextResponse.json(
      { success: false, error: '更新失败' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/collection-items/[id]
 * 删除采集箱条目
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    
    const [deleted] = await db
      .delete(collectionItems)
      .where(eq(collectionItems.id, parseInt(id)))
      .returning({ id: collectionItems.id });
    
    if (!deleted) {
      return NextResponse.json(
        { success: false, error: '条目不存在' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: '删除成功',
    });
  } catch (error) {
    console.error('删除采集箱条目失败:', error);
    return NextResponse.json(
      { success: false, error: '删除失败' },
      { status: 500 }
    );
  }
}
