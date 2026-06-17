import { db } from '@/storage/database/client';
import { shops, orders, orderItems, orderSyncLogs } from '@/storage/database/shared/schema';
import { eq } from 'drizzle-orm';
import { OzonApiClient } from './client';

export interface SyncResult {
  shopId: string;
  shopName: string;
  success: boolean;
  fetched?: number;
  created?: number;
  updated?: number;
  error?: string;
}

// 同步单个店铺的订单
export async function syncShopOrders(shopId: string): Promise<SyncResult> {
  // 获取店铺信息
  const shopList = await db
    .select()
    .from(shops)
    .where(eq(shops.id, shopId))
    .limit(1);

  if (shopList.length === 0) {
    return {
      shopId,
      shopName: '',
      success: false,
      error: '店铺不存在',
    };
  }

  const shop = shopList[0];

  if (!shop.isActive) {
    return {
      shopId: shop.id,
      shopName: shop.name,
      success: false,
      error: '店铺已停用',
    };
  }

  const client = new OzonApiClient({
    clientId: shop.clientId,
    apiKey: shop.apiKey,
  });
  const startedAt = new Date();

  try {
    // 获取已付款待打包的订单
    const response = await client.getFbsOrders({
      filter: {
        status: 'awaiting_packaging',
      },
      limit: 100,
    });

    const postings = response.result?.postings || [];
    let created = 0;
    let updated = 0;

    for (const posting of postings) {
      try {
        // 获取订单详情
        const detailResponse = await client.getFbsOrder(posting.posting_number);

        const orderData = detailResponse.result;
        if (!orderData) continue;

        // 检查订单是否已存在
        const existing = await db
          .select()
          .from(orders)
          .where(eq(orders.ozonPostingNumber, posting.posting_number))
          .limit(1);

        const orderRecord = {
          ozonOrderId: orderData.order_id?.toString() || '',
          ozonPostingNumber: posting.posting_number,
          shopId: shop.id,
          status: 'awaiting_packaging',
          buyerName: orderData.customer?.name || null,
          buyerPhone: orderData.customer?.phone || null,
          recipientName: orderData.address?.recipient || null,
          recipientPhone: orderData.address?.phone || null,
          recipientCity: orderData.address?.city || null,
          recipientAddress: orderData.address?.address_line || null,
          totalPrice: '0',
          productsPrice: '0',
          deliveryPrice: '0',
          ozonRawData: orderData,
          ozonCreatedAt: orderData.created_at ? new Date(orderData.created_at) : null,
          ozonUpdatedAt: orderData.in_process_at ? new Date(orderData.in_process_at) : null,
          updatedAt: new Date(),
        };

        let orderId: string;

        if (existing.length > 0) {
          await db
            .update(orders)
            .set(orderRecord)
            .where(eq(orders.id, existing[0].id));
          orderId = existing[0].id;
          updated++;
        } else {
          const [newOrder] = await db
            .insert(orders)
            .values({
              ...orderRecord,
              createdAt: new Date(),
            })
            .returning({ id: orders.id });
          orderId = newOrder.id;
          created++;
        }

        // 处理订单商品
        const products = orderData.items || [];
        for (const product of products) {
          if (!product.offer_id) continue;

          const existingItem = await db
            .select()
            .from(orderItems)
            .where(eq(orderItems.order_id, orderId))
            .limit(1);

          const itemRecord = {
            order_id: orderId,
            sku: product.offer_id,
            name: product.name || '',
            quantity: product.quantity || 1,
            price: product.price?.toString() || '0',
            ozon_offer_id: product.offer_id,
            ozon_product_id: product.item_id ? Number(product.item_id) : null,
            is_inspected: false,
            updatedAt: new Date(),
          };

          if (existingItem.length > 0) {
            await db
              .update(orderItems)
              .set(itemRecord)
              .where(eq(orderItems.id, existingItem[0].id));
          } else {
            await db.insert(orderItems).values({
              ...itemRecord,
              created_at: new Date(),
            });
          }
        }
      } catch (err) {
        console.error(`处理订单 ${posting.posting_number} 失败:`, err);
      }
    }

    // 更新店铺最后同步时间
    await db
      .update(shops)
      .set({ lastSyncAt: new Date(), updatedAt: new Date() })
      .where(eq(shops.id, shop.id));

    // 记录同步日志
    await db.insert(orderSyncLogs).values({
      shop_id: shop.id,
      sync_type: 'auto',
      status: 'success',
      orders_fetched: postings.length,
      orders_created: created,
      orders_updated: updated,
      started_at: startedAt,
      finished_at: new Date(),
      created_at: new Date(),
    });

    return {
      shopId: shop.id,
      shopName: shop.name,
      success: true,
      fetched: postings.length,
      created,
      updated,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '同步失败';

    // 记录失败日志
    await db.insert(orderSyncLogs).values({
      shop_id: shop.id,
      sync_type: 'auto',
      status: 'failed',
      error_message: errorMessage,
      started_at: startedAt,
      finished_at: new Date(),
      created_at: new Date(),
    });

    return {
      shopId: shop.id,
      shopName: shop.name,
      success: false,
      error: errorMessage,
    };
  }
}

// 同步所有活跃店铺的订单
export async function syncAllOrders(): Promise<SyncResult[]> {
  const shopList = await db
    .select()
    .from(shops)
    .where(eq(shops.isActive, true));

  const results: SyncResult[] = [];

  for (const shop of shopList) {
    const result = await syncShopOrders(shop.id);
    results.push(result);
  }

  return results;
}
