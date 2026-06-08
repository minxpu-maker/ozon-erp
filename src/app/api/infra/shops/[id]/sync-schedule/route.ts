import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/storage/database/client';
import { eq } from 'drizzle-orm';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/infra/shops/[id]/sync-schedule - 获取店铺同步调度配置
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const schedules = await db.select()
      .from(schema.syncSchedules)
      .where(eq(schema.syncSchedules.id, parseInt(id)));

    return NextResponse.json({
      success: true,
      data: schedules
    });
  } catch (error) {
    console.error('[API] 获取同步调度配置失败:', error);
    return NextResponse.json(
      { success: false, error: '获取同步调度配置失败' },
      { status: 500 }
    );
  }
}

// POST /api/infra/shops/[id]/sync-schedule - 配置同步调度
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { domain, apiEndpoint, cronExpression, frequency, isActive } = body;

    if (!domain) {
      return NextResponse.json(
        { success: false, error: '缺少必填字段: domain' },
        { status: 400 }
      );
    }

    const [schedule] = await db.insert(schema.syncSchedules)
      .values({
        domain,
        apiEndpoint: apiEndpoint || null,
        cronExpression: cronExpression || null,
        frequency: frequency || 'daily',
        isActive: isActive !== false,
        lastSyncAt: null,
        lastSyncStatus: null,
        lastError: null,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();

    return NextResponse.json({
      success: true,
      data: schedule
    });
  } catch (error) {
    console.error('[API] 配置同步调度失败:', error);
    return NextResponse.json(
      { success: false, error: '配置同步调度失败' },
      { status: 500 }
    );
  }
}

// PATCH /api/infra/shops/[id]/sync-schedule - 更新同步调度
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updateData: Record<string, unknown> = {
      updatedAt: new Date()
    };

    const allowedFields = ['isActive', 'cronExpression', 'frequency', 'lastSyncAt', 'lastSyncStatus', 'lastError'];
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    const [updated] = await db.update(schema.syncSchedules)
      .set(updateData)
      .where(eq(schema.syncSchedules.id, parseInt(id)))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { success: false, error: '同步调度不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updated
    });
  } catch (error) {
    console.error('[API] 更新同步调度失败:', error);
    return NextResponse.json(
      { success: false, error: '更新同步调度失败' },
      { status: 500 }
    );
  }
}
