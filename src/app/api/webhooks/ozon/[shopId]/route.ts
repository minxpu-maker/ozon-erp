import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { shops, webhookLogs } from '@/db/schema/fulfillment';
import { eq } from 'drizzle-orm';

// Ozon 允许的IP段（实际生产中应从环境变量读取）
const ALLOWED_IPS = [
  '13.57.221.91',
  '13.57.221.114',
  '18.144.89.65',
  '18.144.89.68',
  '52.53.139.92',
  '52.53.139.99',
  '54.153.1.74',
  '54.153.1.94',
  '54.176.73.51',
  '54.176.73.52',
  '54.241.32.64',
  '54.241.32.66',
];

function isAllowedIp(ip: string | null): boolean {
  if (!ip) return false;
  // 本地开发环境跳过IP检查
  if (process.env.NODE_ENV === 'development') return true;
  return ALLOWED_IPS.includes(ip);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ shopId: string }> }
) {
  const { shopId } = await params;

  // 1. IP白名单检查
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || null;

  if (!isAllowedIp(clientIp)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 2. 解析请求体
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // 3. 提取关键字段
  const messageId = (body.message_id || body.messageId) as string | null;
  const messageType = (body.event_type || body.eventType || body.type) as string;
  const postingNumber = (body.posting_number || body.postingNumber) as string | null;

  if (!messageType) {
    return NextResponse.json({ error: 'Missing event_type' }, { status: 400 });
  }

  // 4. 店铺校验
  const shopResult = await db.select().from(shops).where(eq(shops.id, shopId)).limit(1);
  const shop = shopResult[0];

  if (!shop) {
    return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
  }

  // 5. 幂等检查（message_id唯一）
  if (messageId) {
    const existing = await db.select({ id: webhookLogs.id })
      .from(webhookLogs)
      .where(eq(webhookLogs.messageId, messageId))
      .limit(1);
    if (existing.length > 0) {
      return NextResponse.json({ result: true });
    }
  }

  // 6. 写入日志
  const logId = crypto.randomUUID();
  await db.insert(webhookLogs).values({
    id: logId,
    shopId: shopId,
    messageId: messageId || null,
    eventType: messageType,
    postingNumber: postingNumber || null,
    orderId: null,
    rawPayload: body,
    processed: false,
    isRead: false,
    errorMessage: null,
  });

  // 7. 立即返回Ozon要求的响应格式
  return NextResponse.json({ result: true });

  // 8. 异步处理逻辑在B04-3~B04-5中实现
  // 此处后续会根据messageType分发到不同处理函数
}

// GET方法用于健康检查
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shopId: string }> }
) {
  const { shopId } = await params;
  return NextResponse.json({
    status: 'ok',
    shopId: shopId,
    message: 'Ozon Webhook endpoint is active',
  });
}
