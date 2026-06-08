import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/storage/database/client';
import { eq } from 'drizzle-orm';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/image-listing/templates/[id] - 获取单个模板
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const [template] = await db.select()
      .from(schema.imageTemplates)
      .where(eq(schema.imageTemplates.id, parseInt(id)));

    if (!template) {
      return NextResponse.json(
        { success: false, error: '模板不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: template
    });
  } catch (error) {
    console.error('[API] 获取模板详情失败:', error);
    return NextResponse.json(
      { success: false, error: '获取模板详情失败' },
      { status: 500 }
    );
  }
}

// PATCH /api/image-listing/templates/[id] - 更新模板
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updateData: Record<string, unknown> = {
      updatedAt: new Date()
    };

    const allowedFields = [
      'name', 'type', 'config', 'ozonSpec',
      'previewImageKey', 'applicableCategoryIds', 'isActive'
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    const [updated] = await db.update(schema.imageTemplates)
      .set(updateData)
      .where(eq(schema.imageTemplates.id, parseInt(id)))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { success: false, error: '模板不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updated
    });
  } catch (error) {
    console.error('[API] 更新模板失败:', error);
    return NextResponse.json(
      { success: false, error: '更新模板失败' },
      { status: 500 }
    );
  }
}

// DELETE /api/image-listing/templates/[id] - 删除模板
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const [deleted] = await db.delete(schema.imageTemplates)
      .where(eq(schema.imageTemplates.id, parseInt(id)))
      .returning();

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: '模板不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: deleted
    });
  } catch (error) {
    console.error('[API] 删除模板失败:', error);
    return NextResponse.json(
      { success: false, error: '删除模板失败' },
      { status: 500 }
    );
  }
}
