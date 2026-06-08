import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/storage/database/client';
import { eq } from 'drizzle-orm';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/image-listing/images/[id] - 获取单张图片详情
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const [imageSet] = await db.select()
      .from(schema.imageSets)
      .where(eq(schema.imageSets.id, parseInt(id)));

    if (!imageSet) {
      return NextResponse.json(
        { success: false, error: '图片不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: imageSet
    });
  } catch (error) {
    console.error('[API] 获取图片详情失败:', error);
    return NextResponse.json(
      { success: false, error: '获取图片详情失败' },
      { status: 500 }
    );
  }
}

// PATCH /api/image-listing/images/[id] - 更新图片信息
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updateData: Record<string, unknown> = {
      updatedAt: new Date()
    };

    const allowedFields = [
      'processedImages', 'primaryImageIndex', 'templateId',
      'status', 'reviewerId', 'rejectReason', 'complianceChecks'
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // 审核状态变更
    if (body.status === 'approved' || body.status === 'rejected') {
      updateData.reviewedAt = new Date();
    }

    const [updated] = await db.update(schema.imageSets)
      .set(updateData)
      .where(eq(schema.imageSets.id, parseInt(id)))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { success: false, error: '图片不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updated
    });
  } catch (error) {
    console.error('[API] 更新图片失败:', error);
    return NextResponse.json(
      { success: false, error: '更新图片失败' },
      { status: 500 }
    );
  }
}

// DELETE /api/image-listing/images/[id] - 删除图片
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // 获取图片记录
    const [imageSet] = await db.select()
      .from(schema.imageSets)
      .where(eq(schema.imageSets.id, parseInt(id)));

    if (!imageSet) {
      return NextResponse.json(
        { success: false, error: '图片不存在' },
        { status: 404 }
      );
    }

    // TODO: 删除S3文件
    // if (imageSet.originalImages) {
    //   for (const img of imageSet.originalImages as any[]) {
    //     await deleteFromS3(img.key);
    //   }
    // }

    // 删除数据库记录
    await db.delete(schema.imageSets)
      .where(eq(schema.imageSets.id, parseInt(id)));

    return NextResponse.json({
      success: true,
      data: { id: parseInt(id), deleted: true }
    });
  } catch (error) {
    console.error('[API] 删除图片失败:', error);
    return NextResponse.json(
      { success: false, error: '删除图片失败' },
      { status: 500 }
    );
  }
}
