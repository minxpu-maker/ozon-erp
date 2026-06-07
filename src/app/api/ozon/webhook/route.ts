import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { sql } from 'drizzle-orm';

/**
 * Ozon 推送通知 Webhook 接口
 * 
 * 支持的通知类型：
 * 1. 创建新货件 (new_posting)
 * 2. 发货取消 (posting_cancelled)
 * 3. 装运状态变更 (posting_status_changed)
 * 4. 货件递送或发货日期更改 (posting_dates_changed)
 * 
 * 配置方法：
 * 1. 在Ozon卖家后台，转到"设置"→"集成"部分
 * 2. 在"推送通知"选项卡上，启用推送通知
 * 3. 输入此服务的URL：https://你的域名/api/ozon/webhook
 * 4. 点击"检查"，Ozon会发送验证请求
 * 5. 在"通知类型"下拉列表中选择所需的通知类型
 */

// Ozon推送通知类型
type OzonNotificationType = 
  | 'new_posting'           // 创建新货件
  | 'posting_cancelled'     // 发货取消
  | 'posting_status_changed' // 装运状态变更
  | 'posting_dates_changed' // 货件递送或发货日期更改
  | 'chat_new_message'      // 新聊天消息
  | 'chat_closed'           // 聊天关闭
  | 'product_changed'       // 商品变更
  | 'product_stocks_changed'; // 库存变更

interface OzonNotification {
  event_type: OzonNotificationType;
  posting_number?: string;
  order_id?: number;
  old_status?: string;
  new_status?: string;
  product_id?: number;
  offer_id?: string;
  stocks?: number;
  chat_id?: string;
  message_id?: string;
  timestamp: string;
  [key: string]: unknown;
}

// 记录系统日志
async function logNotification(type: string, message: string, data: unknown): Promise<void> {
  try {
    await db.execute(sql`
      INSERT INTO system_logs (type, message, data, created_at)
      VALUES (${type}, ${message}, ${JSON.stringify(data)}, NOW())
    `);
  } catch (error) {
    console.error('[Ozon Webhook] 记录日志失败:', error);
  }
}

// 处理推送通知
async function handleNotification(notification: OzonNotification): Promise<void> {
  console.log(`[Ozon Webhook] 收到通知: ${notification.event_type}`, notification);
  
  switch (notification.event_type) {
    case 'new_posting':
      await handleNewPosting(notification);
      break;
    case 'posting_cancelled':
      await handlePostingCancelled(notification);
      break;
    case 'posting_status_changed':
      await handlePostingStatusChanged(notification);
      break;
    case 'posting_dates_changed':
      await handlePostingDatesChanged(notification);
      break;
    case 'product_stocks_changed':
      await handleStocksChanged(notification);
      break;
    case 'chat_new_message':
      await handleNewChatMessage(notification);
      break;
    default:
      console.log(`[Ozon Webhook] 未处理的通知类型: ${notification.event_type}`);
  }
}

// 处理新货件通知
async function handleNewPosting(notification: OzonNotification): Promise<void> {
  const { posting_number, order_id } = notification;
  console.log(`[Ozon Webhook] 新订单: ${posting_number}, 订单ID: ${order_id}`);
  
  await logNotification('ozon_notification', `新订单 ${posting_number}`, notification);
}

// 处理发货取消通知
async function handlePostingCancelled(notification: OzonNotification): Promise<void> {
  const { posting_number } = notification;
  console.log(`[Ozon Webhook] 订单取消: ${posting_number}`);
  
  try {
    await db.execute(sql`
      UPDATE orders 
      SET status = 'cancelled', 
          ozon_raw_data = jsonb_set(ozon_raw_data, '{cancelled_notification}', ${JSON.stringify(notification)}::jsonb),
          updated_at = NOW()
      WHERE ozon_posting_number = ${posting_number}
    `);
  } catch (error) {
    console.error(`[Ozon Webhook] 更新订单状态失败:`, error);
  }
  
  await logNotification('ozon_notification', `订单取消 ${posting_number}`, notification);
}

// 处理状态变更通知
async function handlePostingStatusChanged(notification: OzonNotification): Promise<void> {
  const { posting_number, old_status, new_status } = notification;
  console.log(`[Ozon Webhook] 状态变更: ${posting_number}, ${old_status} -> ${new_status}`);
  
  try {
    await db.execute(sql`
      UPDATE orders 
      SET status = ${new_status},
          ozon_raw_data = jsonb_set(
            jsonb_set(ozon_raw_data, '{old_status}', ${JSON.stringify(old_status)}::jsonb),
            '{status_notification}', ${JSON.stringify(notification)}::jsonb
          ),
          updated_at = NOW()
      WHERE ozon_posting_number = ${posting_number}
    `);
  } catch (error) {
    console.error(`[Ozon Webhook] 更新订单状态失败:`, error);
  }
  
  await logNotification('ozon_notification', `状态变更 ${posting_number}: ${old_status} -> ${new_status}`, notification);
}

// 处理日期变更通知
async function handlePostingDatesChanged(notification: OzonNotification): Promise<void> {
  const { posting_number } = notification;
  console.log(`[Ozon Webhook] 日期变更: ${posting_number}`);
  
  await logNotification('ozon_notification', `订单日期变更 ${posting_number}`, notification);
}

// 处理库存变更通知
async function handleStocksChanged(notification: OzonNotification): Promise<void> {
  const { offer_id, stocks, product_id } = notification;
  console.log(`[Ozon Webhook] 库存变更: SKU=${offer_id}, 库存=${stocks}`);
  
  await logNotification('ozon_notification', `库存变更 SKU=${offer_id}`, notification);
}

// 处理新聊天消息
async function handleNewChatMessage(notification: OzonNotification): Promise<void> {
  const { chat_id, message_id } = notification;
  console.log(`[Ozon Webhook] 新聊天消息: chat=${chat_id}, message=${message_id}`);
  
  await logNotification('ozon_notification', `新聊天消息`, notification);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // 验证请求来源（可选，增加安全性）
    const signature = request.headers.get('x-ozon-signature');
    // TODO: 验证签名
    
    // 处理单个通知
    if (body.event_type) {
      await handleNotification(body as OzonNotification);
    }
    
    // 处理批量通知
    if (Array.isArray(body.notifications)) {
      for (const notification of body.notifications) {
        await handleNotification(notification);
      }
    }
    
    return NextResponse.json({ success: true, received: true });
  } catch (error) {
    console.error('[Ozon Webhook] 处理通知失败:', error);
    return NextResponse.json(
      { success: false, error: '处理通知失败' },
      { status: 500 }
    );
  }
}

// Ozon验证连接时发送GET请求
export async function GET(request: NextRequest) {
  console.log('[Ozon Webhook] 连接验证请求:', request.url);
  
  // 返回成功响应，表示URL可用
  return NextResponse.json({ 
    success: true, 
    message: 'Ozon Webhook URL 可用于连接',
    timestamp: new Date().toISOString()
  });
}

// 支持HEAD请求用于健康检查
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}
