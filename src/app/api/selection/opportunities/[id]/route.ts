import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/storage/database/client';
import { eq, and } from 'drizzle-orm';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/selection/opportunities/[id] - 获取单个选品单详情
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const [opportunity] = await db.select()
      .from(schema.opportunities)
      .where(eq(schema.opportunities.id, parseInt(id)));

    if (!opportunity) {
      return NextResponse.json(
        { success: false, error: '选品单不存在' },
        { status: 404 }
      );
    }

    // 关联查询评分数据
    const scores = await db.select()
      .from(schema.productScores)
      .where(eq(schema.productScores.opportunityId, parseInt(id)));

    return NextResponse.json({
      success: true,
      data: {
        ...opportunity,
        scores
      }
    });
  } catch (error) {
    console.error('[API] 获取选品单详情失败:', error);
    return NextResponse.json(
      { success: false, error: '获取选品单详情失败' },
      { status: 500 }
    );
  }
}

// PATCH /api/selection/opportunities/[id] - 更新选品单状态
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, updatedBy, notes, assignedTo } = body;

    const updateData: Record<string, unknown> = {
      updatedAt: new Date()
    };

    if (status) updateData.status = status;
    if (notes) updateData.notes = notes;
    if (assignedTo) updateData.assignedTo = assignedTo;

    if (status === 'confirmed') {
      updateData.confirmedAt = new Date();
    } else if (status === 'abandoned') {
      updateData.abandonedReason = body.abandonedReason || '用户放弃';
    }

    const [updated] = await db.update(schema.opportunities)
      .set(updateData)
      .where(eq(schema.opportunities.id, parseInt(id)))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { success: false, error: '选品单不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updated
    });
  } catch (error) {
    console.error('[API] 更新选品单失败:', error);
    return NextResponse.json(
      { success: false, error: '更新选品单失败' },
      { status: 500 }
    );
  }
}

// DELETE /api/selection/opportunities/[id] - 软删除（改为abandoned状态）
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const [updated] = await db.update(schema.opportunities)
      .set({
        status: 'abandoned',
        abandonedReason: '用户删除',
        updatedAt: new Date()
      })
      .where(eq(schema.opportunities.id, parseInt(id)))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { success: false, error: '选品单不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updated
    });
  } catch (error) {
    console.error('[API] 删除选品单失败:', error);
    return NextResponse.json(
      { success: false, error: '删除选品单失败' },
      { status: 500 }
    );
  }
}
