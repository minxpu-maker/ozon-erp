import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { webhookLogs } from '@/db/schema/fulfillment';
import { shops, orders, orderItems } from '@/storage/database/shared/schema';
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

// TYPE_NEW_POSTING 订单创建/更新处理函数
async function handleNewPosting(
  body: any,
  shopId: string,
  logId: string
) {
  const posting = body;
  const postingNumber = posting.posting_number || posting.order_number;

  if (!postingNumber) return;

  const orderId = crypto.randomUUID();

  // 1. 解析订单主数据（使用snake_case列名匹配orders表）
  const orderData = {
    id: orderId,
    ozonOrderId: posting.ozon_order_id?.toString() || postingNumber,
    ozonPostingNumber: postingNumber,
    shopId: shopId,
    status: posting.status || 'pending',
    erpStatus: 'pending',
    totalPrice: posting.price?.toString() || '0',
    productsPrice: posting.products_price?.toString() || posting.price?.toString() || '0',
    deliveryPrice: posting.delivery_price?.toString() || '0',
    buyerName: posting.buyer?.name || posting.customer?.name || null,
    isPurchaseBound: false,
    isInspected: false,
    isPacked: false,
    purchasePrice: '0',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // 2. upsert：按 ozon_posting_number 查重
  const existing = await db.select({ id: orders.id })
    .from(orders)
    .where(eq(orders.ozonPostingNumber, postingNumber))
    .limit(1);

  if (existing.length > 0) {
    // 已存在 → 更新
    const existingOrderId = existing[0].id;
    await db.update(orders)
      .set({
        shopId: orderData.shopId,
        status: orderData.status,
        erpStatus: orderData.erpStatus,
        totalPrice: orderData.totalPrice,
        productsPrice: orderData.productsPrice,
        deliveryPrice: orderData.deliveryPrice,
        buyerName: orderData.buyerName,
        isPurchaseBound: orderData.isPurchaseBound,
        isInspected: orderData.isInspected,
        isPacked: orderData.isPacked,
        purchasePrice: orderData.purchasePrice,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, existingOrderId));

    // 删除旧商品明细，重新插入
    await db.delete(orderItems).where(eq(orderItems.order_id, existingOrderId));

    if (posting.products && Array.isArray(posting.products)) {
      for (const product of posting.products) {
        await db.insert(orderItems).values({
          id: crypto.randomUUID(),
          order_id: existingOrderId,
          sku: product.sku || product.offer_id || null,
          name: product.name || null,
          quantity: product.quantity || 1,
          price: product.price || product.sum_price || '0',
          ozon_offer_id: product.offer_id?.toString() || null,
          ozon_product_id: product.product_id ? Number(product.product_id) : null,
          source_type: null,
          source_url: null,
          source_price: null,
          inspected_quantity: 0,
          is_inspected: false,
        });
      }
    }
  } else {
    // 不存在 → 创建
    await db.insert(orders).values(orderData);
    if (posting.products && Array.isArray(posting.products)) {
      for (const product of posting.products) {
        await db.insert(orderItems).values({
          id: crypto.randomUUID(),
          order_id: orderId,
          sku: product.sku || product.offer_id || null,
          name: product.name || null,
          quantity: product.quantity || 1,
          price: product.price || product.sum_price || '0',
          ozon_offer_id: product.offer_id?.toString() || null,
          ozon_product_id: product.product_id ? Number(product.product_id) : null,
          source_type: null,
          source_url: null,
          source_price: null,
          inspected_quantity: 0,
          is_inspected: false,
        });
      }
    }
  }

  // 3. 更新 webhook_logs 标记已处理
  await db.update(webhookLogs)
    .set({ processed: true, orderId: existing.length > 0 ? existing[0].id : orderId })
    .where(eq(webhookLogs.id, logId));
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

  // 7. 异步处理（不await，不阻塞响应）
  void (async () => {
    try {
      switch (messageType) {
        case 'TYPE_NEW_POSTING':
          await handleNewPosting(body, shopId, logId);
          break;
        // B04-4: TYPE_STATE_CHANGED, TYPE_POSTING_CANCELLED
        // B04-5: 其他事件类型
        default:
          await db.update(webhookLogs)
            .set({ processed: true })
            .where(eq(webhookLogs.id, logId));
          break;
      }
    } catch (error: any) {
      await db.update(webhookLogs)
        .set({ processed: false, errorMessage: error.message || String(error) })
        .where(eq(webhookLogs.id, logId));
    }
  })();

  // 8. 立即返回Ozon要求的响应格式
  return NextResponse.json({ result: true });
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
