import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { shops, webhookLogs } from '@/db/schema/fulfillment';
import { eq, desc } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: shopId } = await params;

  const shop = await db.select().from(shops).where(eq(shops.id, shopId)).limit(1);

  if (shop.length === 0) {
    return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
  }

  const shopData = shop[0];

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `https://${request.headers.get('host')}`;
  const webhookUrl = `${baseUrl}/api/webhooks/ozon/${shopId}`;

  const recentLogs = await db.select({
    id: webhookLogs.id,
    eventType: webhookLogs.eventType,
    postingNumber: webhookLogs.postingNumber,
    processed: webhookLogs.processed,
    isRead: webhookLogs.isRead,
    errorMessage: webhookLogs.errorMessage,
    createdAt: webhookLogs.createdAt,
  })
    .from(webhookLogs)
    .where(eq(webhookLogs.shopId, shopId))
    .orderBy(desc(webhookLogs.createdAt))
    .limit(5);

  const allLogs = await db.select({
    id: webhookLogs.id,
    eventType: webhookLogs.eventType,
    isRead: webhookLogs.isRead,
  })
    .from(webhookLogs)
    .where(eq(webhookLogs.shopId, shopId));

  const chatTypes = ['TYPE_NEW_MESSAGE', 'TYPE_UPDATE_MESSAGE'] as const;
  const unreadChatCount = allLogs.filter(
    (l) => (chatTypes as readonly string[]).includes(l.eventType) && !l.isRead
  ).length;

  const totalCount = allLogs.length;

  return NextResponse.json({
    enabled: shopData.webhookEnabled || false,
    webhookUrl: webhookUrl,
    lastPushAt: recentLogs.length > 0 ? recentLogs[0].createdAt : null,
    totalCount: totalCount,
    unreadChatCount: unreadChatCount,
    recentLogs: recentLogs,
  });
}
