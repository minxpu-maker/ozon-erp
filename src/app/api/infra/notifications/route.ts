import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/storage/database/client';
import { desc, eq, and } from 'drizzle-orm';

// GET /api/infra/notifications - 获取通知列表
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const isRead = searchParams.get('isRead');
    const type = searchParams.get('type');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    const conditions = [];
    if (userId) conditions.push(eq(schema.notifications.userId, userId));
    if (isRead !== null) conditions.push(eq(schema.notifications.isRead, isRead === 'true'));
    if (type) conditions.push(eq(schema.notifications.type, type));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const items = await db.select()
      .from(schema.notifications)
      .where(whereClause)
      .orderBy(desc(schema.notifications.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({
      success: true,
      data: items
    });
  } catch (error) {
    console.error('[API] 获取通知列表失败:', error);
    return NextResponse.json(
      { success: false, error: '获取通知列表失败' },
      { status: 500 }
    );
  }
}

// POST /api/infra/notifications - 创建通知
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, type, severity, title, body: notificationBody, relatedEntityType, relatedEntityId, actionType, actionData } = body;

    if (!userId || !type || !severity || !title) {
      return NextResponse.json(
        { success: false, error: '缺少必填字段: userId, type, severity, title' },
        { status: 400 }
      );
    }

    const [notification] = await db.insert(schema.notifications)
      .values({
        userId,
        type,
        severity,
        title,
        body: notificationBody || null,
        relatedEntityType: relatedEntityType || null,
        relatedEntityId: relatedEntityId ? parseInt(relatedEntityId) : null,
        isRead: false,
        readAt: null,
        actionType: actionType || null,
        actionData: actionData || null,
        actionCompletedAt: null,
        createdAt: new Date()
      })
      .returning();

    return NextResponse.json({
      success: true,
      data: notification
    });
  } catch (error) {
    console.error('[API] 创建通知失败:', error);
    return NextResponse.json(
      { success: false, error: '创建通知失败' },
      { status: 500 }
    );
  }
}
