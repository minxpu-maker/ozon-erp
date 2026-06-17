import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { shops, webhookLogs } from '@/db/schema/fulfillment';
import { eq, desc } from 'drizzle-orm';

const OZON_API_BASE = 'https://api-seller.ozon.ru';

const ALL_NOTIFICATION_TYPES = [
  'TYPE_PING',
  'TYPE_NEW_POSTING',
  'TYPE_POSTING_CANCELLED',
  'TYPE_STATE_CHANGED',
  'TYPE_CUTOFF_DATE_CHANGED',
  'TYPE_DELIVERY_DATE_CHANGED',
  'TYPE_CREATE_OR_UPDATE_JITEM',
  'TYPE_CREATE_JITEM',
  'TYPE_UPDATE_JITEM',
  'TYPE_STOCKS_CHANGED',
  'TYPE_NEW_MESSAGE',
  'TYPE_UPDATE_MESSAGE',
  'TYPE_MESSAGE_READ',
  'TYPE_CHAT_CLOSED',
];


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

/**
 * POST - 注册或关闭推送
 * body: { action: 'enable' | 'disable' }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: shopId } = await params;

  const body = await request.json();
  const action = body.action;

  if (!action || !['enable', 'disable'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action, must be "enable" or "disable"' }, { status: 400 });
  }

  const shop = await db.select().from(shops).where(eq(shops.id, shopId)).limit(1);

  if (shop.length === 0) {
    return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
  }

  const shopData = shop[0];

  if (!shopData.clientId || !shopData.apiKey) {
    return NextResponse.json({ error: 'Ozon API credentials not configured' }, { status: 400 });
  }

  // API Key解密
  const { decrypt } = await import('@/lib/crypto');
  const apiKey = decrypt(shopData.apiKey);
  const clientId = shopData.clientId;

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `https://${request.headers.get('host')}`;
  const webhookUrl = `${baseUrl}/api/webhooks/ozon/${shopId}`;

  try {
    if (action === 'enable') {
      const response = await fetch(`${OZON_API_BASE}/v1/notification/set`, {
        method: 'POST',
        headers: {
          'Client-Id': clientId,
          'Api-Key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message_types: ALL_NOTIFICATION_TYPES,
          webhook_url: webhookUrl,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return NextResponse.json({ error: `Ozon API error: ${response.status}`, detail: errorText }, { status: 502 });
      }

      const data = await response.json();

      if (data.result === true) {
        await db.update(shops)
          .set({ webhookUrl: webhookUrl, webhookEnabled: true, updatedAt: new Date() })
          .where(eq(shops.id, shopId));

        return NextResponse.json({ success: true, message: 'Webhook enabled', webhookUrl });
      } else {
        return NextResponse.json({ error: 'Ozon API returned false' }, { status: 500 });
      }
    } else {
      const response = await fetch(`${OZON_API_BASE}/v1/notification/delete`, {
        method: 'POST',
        headers: {
          'Client-Id': clientId,
          'Api-Key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message_types: ALL_NOTIFICATION_TYPES,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return NextResponse.json({ error: `Ozon API error: ${response.status}`, detail: errorText }, { status: 502 });
      }

      const data = await response.json();

      if (data.result === true) {
        await db.update(shops)
          .set({ webhookEnabled: false, updatedAt: new Date() })
          .where(eq(shops.id, shopId));

        return NextResponse.json({ success: true, message: 'Webhook disabled' });
      } else {
        return NextResponse.json({ error: 'Ozon API returned false' }, { status: 500 });
      }
    }
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to configure webhook', detail: error.message || String(error) }, { status: 500 });
  }
}
