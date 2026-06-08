import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/storage/database/client';
import { eq } from 'drizzle-orm';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/selection/rules/[id] - 获取单个规则
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const [rule] = await db.select()
      .from(schema.selectionStrategyTemplates)
      .where(eq(schema.selectionStrategyTemplates.id, parseInt(id)));

    if (!rule) {
      return NextResponse.json(
        { success: false, error: '规则不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: rule
    });
  } catch (error) {
    console.error('[API] 获取规则详情失败:', error);
    return NextResponse.json(
      { success: false, error: '获取规则详情失败' },
      { status: 500 }
    );
  }
}

// PATCH /api/selection/rules/[id] - 更新规则
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updateData: Record<string, unknown> = {
      updatedAt: new Date()
    };

    const allowedFields = [
      'name', 'selectionMode', 'ahpConfig', 'hardConstraints',
      'priceRangeMin', 'priceRangeMax', 'isDefault', 'isActive'
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    const [updated] = await db.update(schema.selectionStrategyTemplates)
      .set(updateData)
      .where(eq(schema.selectionStrategyTemplates.id, parseInt(id)))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { success: false, error: '规则不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updated
    });
  } catch (error) {
    console.error('[API] 更新规则失败:', error);
    return NextResponse.json(
      { success: false, error: '更新规则失败' },
      { status: 500 }
    );
  }
}

// DELETE /api/selection/rules/[id] - 删除规则
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const [deleted] = await db.delete(schema.selectionStrategyTemplates)
      .where(eq(schema.selectionStrategyTemplates.id, parseInt(id)))
      .returning();

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: '规则不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: deleted
    });
  } catch (error) {
    console.error('[API] 删除规则失败:', error);
    return NextResponse.json(
      { success: false, error: '删除规则失败' },
      { status: 500 }
    );
  }
}
