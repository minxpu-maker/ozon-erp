import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/storage/database/client';
import { eq } from 'drizzle-orm';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/infra/data-sources/[id] - 获取单个数据源详情
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const [source] = await db.select()
      .from(schema.dataSourceHealth)
      .where(eq(schema.dataSourceHealth.id, parseInt(id)));

    if (!source) {
      return NextResponse.json(
        { success: false, error: '数据源不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: source
    });
  } catch (error) {
    console.error('[API] 获取数据源详情失败:', error);
    return NextResponse.json(
      { success: false, error: '获取数据源详情失败' },
      { status: 500 }
    );
  }
}

// PATCH /api/infra/data-sources/[id] - 更新数据源配置
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updateData: Record<string, unknown> = {
      updatedAt: new Date()
    };

    const allowedFields = ['status', 'metadata'];
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    const [updated] = await db.update(schema.dataSourceHealth)
      .set(updateData)
      .where(eq(schema.dataSourceHealth.id, parseInt(id)))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { success: false, error: '数据源不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updated
    });
  } catch (error) {
    console.error('[API] 更新数据源失败:', error);
    return NextResponse.json(
      { success: false, error: '更新数据源失败' },
      { status: 500 }
    );
  }
}
