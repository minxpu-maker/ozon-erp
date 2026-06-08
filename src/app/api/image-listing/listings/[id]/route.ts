import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/storage/database/client';
import { eq } from 'drizzle-orm';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/image-listing/listings/[id] - 获取上架任务详情
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const [task] = await db.select()
      .from(schema.listingTasks)
      .where(eq(schema.listingTasks.id, parseInt(id)));

    if (!task) {
      return NextResponse.json(
        { success: false, error: '上架任务不存在' },
        { status: 404 }
      );
    }

    // 关联查询商品卡和变体
    const [productCard, variants] = await Promise.all([
      db.select()
        .from(schema.productCards)
        .where(eq(schema.productCards.id, task.productCardId))
        .then(rows => rows[0]),
      db.select()
        .from(schema.productVariants)
        .where(eq(schema.productVariants.productCardId, task.productCardId))
    ]);

    return NextResponse.json({
      success: true,
      data: {
        ...task,
        productCard,
        variants
      }
    });
  } catch (error) {
    console.error('[API] 获取上架任务详情失败:', error);
    return NextResponse.json(
      { success: false, error: '获取上架任务详情失败' },
      { status: 500 }
    );
  }
}

// PATCH /api/image-listing/listings/[id] - 更新上架任务
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updateData: Record<string, unknown> = {
      updatedAt: new Date()
    };

    const allowedFields = [
      'status', 'ozonTaskId', 'ozonProductId', 'logisticsTemplateId',
      'packageWeight', 'packageDimensions', 'resultMessage',
      'lastPollAt', 'failureReason', 'retryCount'
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    const [updated] = await db.update(schema.listingTasks)
      .set(updateData)
      .where(eq(schema.listingTasks.id, parseInt(id)))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { success: false, error: '上架任务不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updated
    });
  } catch (error) {
    console.error('[API] 更新上架任务失败:', error);
    return NextResponse.json(
      { success: false, error: '更新上架任务失败' },
      { status: 500 }
    );
  }
}
