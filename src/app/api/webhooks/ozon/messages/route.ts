import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { webhookLogs } from '@/db/schema/fulfillment';
import { eq, and, asc, inArray } from 'drizzle-orm';

// 聊天类事件类型
const CHAT_EVENT_TYPES = [
  'TYPE_NEW_MESSAGE',
  'TYPE_UPDATE_MESSAGE',
  'TYPE_MESSAGE_READ',
  'TYPE_CHAT_CLOSED',
];

/**
 * GET - 查询订单的买家消息
 * ?posting_number=xxx → 按Ozon订单号查
 * ?shop_id=xxx → 按店铺筛选（可选）
 * ?page=1&page_size=20 → 分页
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const postingNumber = searchParams.get('posting_number');
  const shopId = searchParams.get('shop_id');
  const page = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = parseInt(searchParams.get('page_size') || '50', 10);

  if (!postingNumber) {
    return NextResponse.json({ error: 'posting_number is required' }, { status: 400 });
  }

  // 构建查询条件
  const conditions = [
    eq(webhookLogs.postingNumber, postingNumber),
    inArray(webhookLogs.eventType, CHAT_EVENT_TYPES),
  ];

  if (shopId) {
    conditions.push(eq(webhookLogs.shopId, shopId));
  }

  // 查询消息列表
  const messages = await db.select({
    id: webhookLogs.id,
    eventType: webhookLogs.eventType,
    shopId: webhookLogs.shopId,
    rawPayload: webhookLogs.rawPayload,
    isRead: webhookLogs.isRead,
    processed: webhookLogs.processed,
    errorMessage: webhookLogs.errorMessage,
    createdAt: webhookLogs.createdAt,
  })
    .from(webhookLogs)
    .where(and(...conditions))
    .orderBy(asc(webhookLogs.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  // 统计总数
  const allMessages = await db.select({ id: webhookLogs.id, isRead: webhookLogs.isRead })
    .from(webhookLogs)
    .where(and(...conditions));

  const totalCount = allMessages.length;
  const unreadCount = allMessages.filter((m: { isRead: boolean | null }) => !m.isRead).length;

  // 批量标记为已读
  if (unreadCount > 0) {
    const unreadIds = allMessages
      .filter((m: { isRead: boolean | null }) => !m.isRead)
      .map((m: { id: string }) => m.id);
    for (const id of unreadIds) {
      await db.update(webhookLogs)
        .set({ isRead: true })
        .where(eq(webhookLogs.id, id));
    }
  }

  return NextResponse.json({
    messages: messages,
    total: totalCount,
    unread: unreadCount,
    page: page,
    pageSize: pageSize,
  });
}
