import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/storage/database/client';
import { inArray, sql } from 'drizzle-orm';

// POST /api/selection/opportunities/batch - 批量操作
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ids, action } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { success: false, error: '缺少必填字段: ids (数组)' },
        { status: 400 }
      );
    }

    if (!action || !['confirm', 'abandon'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'action 必须是 confirm 或 abandon' },
        { status: 400 }
      );
    }

    const status = action === 'confirm' ? 'confirmed' : 'abandoned';
    const updateData: Record<string, unknown> = {
      status,
      updatedAt: new Date()
    };

    if (action === 'confirm') {
      updateData.confirmedAt = new Date();
    } else {
      updateData.abandonedReason = '批量放弃';
    }

    const result = await db.update(schema.opportunities)
      .set(updateData)
      .where(inArray(schema.opportunities.id, ids.map(Number)))
      .returning();

    return NextResponse.json({
      success: true,
      data: {
        affected: result.length,
        ids,
        action
      }
    });
  } catch (error) {
    console.error('[API] 批量操作失败:', error);
    return NextResponse.json(
      { success: false, error: '批量操作失败' },
      { status: 500 }
    );
  }
}
