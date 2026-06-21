import { randomUUID } from 'crypto';
/**
 * Ozon订单同步服务核心逻辑
 * 
 * 功能：
 * 1. 从Ozon API拉取FBS订单列表
 * 2. 与本地ozon_orders对比，增量同步
 * 3. 新订单入库并自动生成purchase_demands
 * 4. 状态变更实时更新
 */

import { db } from '@/storage/database/client';
import { purchaseDemands } from '@/storage/database/shared/fulfillment';
import { shops, orders } from '@/storage/database/shared/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { OzonClient } from './ozon-client';
import { decrypt } from './crypto';
import { sql } from 'drizzle-orm';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * Ozon API 返回的 posting 结构
 */
interface OzonPosting {
  order_id: string;
  posting_number: string;
  status: string;
  in_process_at: string;
  // 收件人信息（直接字段，非嵌套）
  recipient_name?: string;
  recipient_city?: string;
  recipient_address?: string | null;
  // 发货截止时间
  shipment_deadline?: string;
  // 备用的新API格式字段
  customer?: {
    name?: string;
    address?: {
      city?: string;
      address_tail?: string;
    };
  };
  addressee?: {
    name?: string;
    phone?: string;
  };
  // 备用的新API格式发货日期
  shipment_date?: string;
  products: Array<{
    sku: string;
    name: string;
    quantity: number;
    price: string; // Ozon API 返回的是字符串
    offer_id?: string; // 商家SKU（本地系统）
    product_id?: number; // Ozon产品ID
    weight?: number | null; // 声明重量（千克）
  }>;
}

/**
 * Ozon API 订单列表响应（/v3/posting/fbs/list 返回包装在 result 中）
 */
interface OzonPostingListResponse {
  result: {
    postings: OzonPosting[];
    has_next: boolean;
    count?: number;
  };
}

/**
 * 同步结果
 */
export interface SyncResult {
  shopId: string;
  shopName: string;
  success: boolean;
  newOrders: number;
  updatedOrders: number;
  newDemands: number;
  errors: string[];
}

/**
 * 批量同步结果
 */
export interface BatchSyncResult {
  success: boolean;
  syncedShops: number;
  failedShops: number;
  newOrders: number;
  updatedOrders: number;
  newDemands: number;
  shopResults: SyncResult[];
  errors: Array<{ shopId: string; shopName: string; error: string }>;
}

/**
 * 店铺同步状态
 */
export interface ShopSyncStatus {
  shopId: string;
  shopName: string;
  lastSyncAt: Date | null;
  status: 'success' | 'error' | 'never';
  error?: string;
  newOrders: number;
  updatedOrders: number;
}

// ============================================================================
// 状态映射
// ============================================================================

/**
 * Ozon状态 → ERP状态映射
 * 根据Ozon官方API严格映射：
 * - awaiting_deliver（已准备发运）→ pending_purchase（待采购）
 * - awaiting_packaging（等待打包）→ pending_packaging（等待打包，不算待采购）
 */
const OZON_TO_ERP_STATUS_MAP: Record<string, string> = {
  // 已准备发运 → 待采购
  'awaiting-deliver': 'pending_purchase',
  'awaiting_deliver': 'pending_purchase',
  // 等待打包 → 等待打包（不算待采购）
  'awaiting-packaging': 'pending_packaging',
  'awaiting_packaging': 'pending_packaging',
  'awaiting-pack': 'pending_packaging',
  // 运输中 → 运输中
  'delivering': 'shipped_domestic',
  'delivered': 'shipped',
  // 取消
  'cancelled': 'cancelled',
  'refunded': 'cancelled',
};

/**
 * 获取ERP状态
 * @param ozonStatus Ozon原始状态
 * @returns ERP状态，未知状态返回 null
 */
function getErpStatus(ozonStatus: string): string | null {
  return OZON_TO_ERP_STATUS_MAP[ozonStatus] || null;
}

// ============================================================================
// Priority 计算
// ============================================================================

/**
 * 根据发货截止时间计算优先级
 * - deadline < now + 24h → 'high'
 * - deadline < now + 72h → 'normal'
 * - 其余 → 'low'
 */
function calculatePriority(shipmentDeadline: Date | null): 'high' | 'normal' | 'low' {
  if (!shipmentDeadline) {
    return 'normal';
  }
  
  const now = new Date();
  const hoursUntilDeadline = (shipmentDeadline.getTime() - now.getTime()) / (1000 * 60 * 60);
  
  if (hoursUntilDeadline < 24) {
    return 'high';
  } else if (hoursUntilDeadline < 72) {
    return 'normal';
  } else {
    return 'low';
  }
}

// ============================================================================
// 核心同步逻辑
// ============================================================================

/**
 * 为单个店铺同步订单
 */
export async function syncOrdersForShop(shop: {
  id: string;
  name: string;
  clientId: string;
  apiKey: string;
}): Promise<SyncResult> {
  const result: SyncResult = {
    shopId: shop.id,
    shopName: shop.name,
    success: false,
    newOrders: 0,
    updatedOrders: 0,
    newDemands: 0,
    errors: [],
  };

  try {
    // 创建Ozon客户端
    const client = new OzonClient({
      clientId: shop.clientId,
      apiKey: shop.apiKey,
    });

    // 获取所有订单（分页）
    const allPostings = await fetchAllPostings(client);
    
    if (allPostings.length === 0) {
      result.success = true;
      return result;
    }

    // 获取每个订单的详细图片信息和product_id
    type ProductInfo = { imageUrl?: string; productId?: number };
    const productImagesMap: Record<string, ProductInfo> = {};
    for (const posting of allPostings) {
      try {
        // 从订单products中提取offer_ids（Ozon订单API不返回product_id，需要通过商品接口获取）
        const offerIds = posting.products
          .map(p => p.offer_id)
          .filter((id): id is string => !!id && id.length > 0);
        
        if (offerIds.length > 0) {
          const details = await client.getPostingDetails(posting.posting_number, offerIds);
          for (const [offerId, info] of Object.entries(details)) {
            productImagesMap[`${posting.posting_number}:${offerId}`] = info;
          }
        }
      } catch (e) {
        // 获取图片失败不影响主流程
        console.warn(`[syncShopOrders] 获取订单详情失败: ${posting.posting_number}`);
      }
    }

    // 获取本地已有的订单（确保order_id类型转换为string）
    const ozonOrderIds = allPostings.map(p => String(p.order_id));
    const existingOrders = await db
      .select({
        id: orders.id,
        ozonOrderId: orders.ozonOrderId,
        orderStatus: orders.status,
        erpStatus: orders.erpStatus,
      })
      .from(orders)
      .where(
        and(
          eq(orders.shopId, shop.id),
          inArray(orders.ozonOrderId, ozonOrderIds)
        )
      );
    
    // 转换为Map方便查询
    const existingOrderMap = new Map(
      existingOrders.map(o => [o.ozonOrderId, o])
    );

    // 分类订单：新订单 vs 已有订单
    const newPostings: OzonPosting[] = [];
    const existingPostings: Array<{ posting: OzonPosting; localOrder: typeof existingOrders[0] }> = [];

    for (const posting of allPostings) {
      const existing = existingOrderMap.get(String(posting.order_id));
      if (existing) {
        existingPostings.push({ posting, localOrder: existing });
      } else {
        newPostings.push(posting);
      }
    }

    // 处理新订单
    if (newPostings.length > 0) {
      const insertResults = await insertNewOrders(shop.id, newPostings, productImagesMap);
      result.newOrders += insertResults.orders;
      result.newDemands += insertResults.demands;
      // insertResults.updated 是"根据posting_number判断为已存在"的订单，不是状态变更
      // 累加而非覆盖，后续循环还会检测真正的状态变更
      result.updatedOrders += insertResults.updated;
    }

    // 处理已有订单（状态变更检测）
    for (const { posting, localOrder } of existingPostings) {
      if (posting.status !== localOrder.orderStatus) {
        const newErpStatus = getErpStatus(posting.status);
        await db
          .update(orders)
          .set({
            status: posting.status,
            erpStatus: newErpStatus,
            lastSyncedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(orders.id, localOrder.id));
        result.updatedOrders++;
      } else {
        // 仅更新时间
        await db
          .update(orders)
          .set({
            lastSyncedAt: new Date(),
          })
          .where(eq(orders.id, localOrder.id));
      }
    }

    result.success = true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    result.errors.push(errorMessage);
    console.error(`[OrderSync] 同步店铺 ${shop.name} 失败:`, errorMessage);
  }

  return result;
}

/**
 * 获取所有订单（处理分页）
 */
async function fetchAllPostings(client: OzonClient): Promise<OzonPosting[]> {
  const allPostings: OzonPosting[] = [];
  let hasNext = true;
  const maxPages = 20; // 防止无限循环
  let currentOffset = 0;

  // 默认拉取最近90天的订单
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  while (hasNext && maxPages > allPostings.length / 50) {
    const body: Record<string, unknown> = {
      dir: 'ASC',
      limit: 50,
      offset: currentOffset,
      filter: {
        since: ninetyDaysAgo.toISOString(),
        to: now.toISOString(),
      },
      with: {
        analytics_data: true,
        financial_data: true,
        barcodes: true,
        customer_data: true,
      },
    };

    const response = await client.post<OzonPostingListResponse>(
      '/v3/posting/fbs/list',
      body
    );

    if (!response.ok || !response.data) {
      throw new Error(response.error || '获取Ozon订单列表失败');
    }

    allPostings.push(...response.data.result.postings);
    hasNext = response.data.result.has_next;
    
    // 调试：打印第一个订单的字段
    if (allPostings.length > 0 && currentOffset === 0) {
      const first = allPostings[0];
      console.log('[DEBUG] First posting keys:', Object.keys(first).join(', '));
      console.log('[DEBUG] First posting:', JSON.stringify(first).substring(0, 500));
      // 打印关键对象
      if (first.customer) console.log('[DEBUG] customer:', JSON.stringify(first.customer));
      if (first.addressee) console.log('[DEBUG] addressee:', JSON.stringify(first.addressee));
      if (first.products?.[0]) console.log('[DEBUG] first product:', JSON.stringify(first.products[0]));
    }
  }

  return allPostings;
}

/**
 * 插入新订单到 orders 表（与 API 读取的表一致）
 */
async function insertNewOrders(
  shopId: string,
  postings: OzonPosting[],
  productImagesMap: Record<string, { imageUrl?: string; productId?: number }>
): Promise<{ orders: number; demands: number; updated: number }> {
  let newOrdersCount = 0;
  let updatedOrdersCount = 0;
  let newDemandsCount = 0;
  const now = new Date();

  // 【关键】从 shops 表获取店铺名称，确保同步
  const shopInfoResult = await db
    .select({ name: shops.name })
    .from(shops)
    .where(eq(shops.id, shopId))
    .limit(1);
  const shopName = shopInfoResult.length > 0 ? shopInfoResult[0].name || '' : '';

  // 查询已有的 ozonPostingNumber，避免重复插入
  const existingPostings = await db
    .select({ ozonPostingNumber: orders.ozonPostingNumber })
    .from(orders)
    .where(eq(orders.shopId, shopId));
  const existingNumbers = new Set(existingPostings.map(r => r.ozonPostingNumber));

  for (const posting of postings) {
    // 跳过已存在的订单
    if (existingNumbers.has(posting.posting_number)) {
      continue;
    }

    // 计算订单总金额（RUB）
    const totalPrice = posting.products.reduce((sum, item) => {
      return sum + (parseFloat(item.price) || 0) * item.quantity;
    }, 0);

    // 转换发货截止时间（直接使用posting.shipment_deadline）
    let shipmentDeadline: string | null = null;
    const deadlineSource = posting.shipment_date;
    if (deadlineSource && typeof deadlineSource === 'string' && deadlineSource.trim() !== '' && deadlineSource !== '0001-01-01T00:00:00Z') {
      const parsed = new Date(deadlineSource);
      if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 2000) {
        shipmentDeadline = parsed.toISOString(); // 转换为 ISO 字符串
      }
    }
    
    // 确保 shipmentDeadline 是有效值
    const shipmentDeadlineValue = shipmentDeadline || null;

    // 转换订单创建时间
    let ozonCreatedAt: Date | null = null;
    if (posting.in_process_at) {
      ozonCreatedAt = new Date(posting.in_process_at);
    }

    // 提取收件人信息（支持多种API格式）
    // 格式1: customer.address.city (较新API)
    // 格式2: recipient_city (某些版本)
    const recipientName = posting.customer?.name || (posting as any).recipient_name || null;
    const recipientCity = posting.customer?.address?.city || (posting as any).recipient_city || null;
    const recipientAddress = posting.customer?.address?.address_tail || (posting as any).recipient_address || null;

    // 构建原始数据（包含商品列表和收件人信息，供前端展示）
    // 从productImagesMap获取图片URL和product_id
    const productImages = productImagesMap[posting.posting_number] || {};
    const ozonRawData: Record<string, unknown> = {
      posting_number: posting.posting_number,
      order_id: posting.order_id,
      status: posting.status,
      shipment_deadline: shipmentDeadline,
      recipient_city: recipientCity,
      recipient_name: recipientName,
      recipient_address: recipientAddress,
      products: posting.products.map((p: any) => {
        // 从productImagesMap获取图片URL和product_id
        const productKey = `${posting.posting_number}:${p.offer_id}`;
        const productInfo = productImagesMap[productKey] || (productImages as any)?.[p.offer_id] || {};
        const info = typeof productInfo === 'object' ? productInfo : { imageUrl: productInfo };
        return {
          sku: p.sku,
          name: p.name,
          quantity: p.quantity,
          price: p.price,
          offer_id: p.offer_id ?? null,
          product_id: info.productId ?? p.product_id ?? null,
          weight: p.weight ?? null,
          // 优先使用getPostingDetails获取的图片，否则使用API返回的
          image: info.imageUrl || (p.images && p.images[0])?.url || null,
          images: p.images ?? [],
        };
      }),
    };

    // 转换订单创建时间（Date对象转ISO字符串）
    const ozonCreatedAtStr = ozonCreatedAt ? ozonCreatedAt.toISOString() : null;
    
    // JSON数据序列化为字符串（确保单引号正确转义）
    const ozonRawDataJson = JSON.stringify(ozonRawData).replace(/'/g, "''");

    // 处理收件人信息（确保NULL而不是空字符串）
    const recipientNameVal = recipientName ? recipientName : sql`NULL`;
    const recipientCityVal = recipientCity ? recipientCity : sql`NULL`;
    const recipientAddressVal = recipientAddress ? recipientAddress : sql`NULL`;
    const shipmentDeadlineVal = (shipmentDeadlineValue === null || shipmentDeadlineValue === '') ? sql`NULL` : shipmentDeadlineValue;
    
    // 生成订单UUID
    const orderUuid = randomUUID();
    
    // 检查订单是否已存在（根据 posting_number）
    const existingOrder = await db
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.ozonPostingNumber, posting.posting_number))
      .limit(1);

    if (existingOrder.length > 0) {
      // 订单已存在，更新状态
      await db
        .update(orders)
        .set({
          status: posting.status,
          erpStatus: getErpStatus(posting.status),
          ozonRawData: ozonRawData,
          ozonUpdatedAt: new Date(),
          lastSyncedAt: new Date(),
        })
        .where(eq(orders.ozonPostingNumber, posting.posting_number));
      
      updatedOrdersCount++;
    } else {
      // 插入到 orders 表（新订单根据Ozon状态动态设置erp_status）
      await db
        .insert(orders)
        .values({
          id: orderUuid,
          ozonOrderId: String(posting.order_id),
          ozonPostingNumber: posting.posting_number,
          shopId: shopId,
          shopName: shopName, // 【关键】从 shops 表同步店铺名称
          status: posting.status,
          buyerName: undefined,
          buyerPhone: undefined,
          recipientName: recipientName || undefined,
          recipientPhone: undefined,
          recipientCity: recipientCity || undefined,
          recipientAddress: recipientAddress || undefined,
          totalPrice: String(totalPrice),
          productsPrice: '0',
          deliveryPrice: '0',
          trackingNumber: undefined,
          shippedAt: undefined,
          deliveredAt: undefined,
          isPurchaseBound: false,
          purchaseBoundAt: undefined,
          isInspected: false,
          inspectedAt: undefined,
          isPacked: false,
          packedAt: undefined,
          packageWeight: undefined,
          isSettled: false,
          settledAt: undefined,
          purchasePrice: '0',
          ozonRawData: ozonRawData,
          ozonCreatedAt: ozonCreatedAt ? new Date(ozonCreatedAt) : new Date(),
          ozonUpdatedAt: undefined,
          erpStatus: getErpStatus(posting.status),
          currency: 'RUB',
          shipmentDeadline: shipmentDeadlineValue ? new Date(shipmentDeadlineValue) : undefined,
          lastSyncedAt: new Date(),
          purchasePlatform: undefined,
          purchaseUrl: undefined,
          purchaseQty: undefined,
          purchaseTotalAmount: undefined,
          purchaseTrackingNumber: undefined,
          purchaseNote: undefined,
          purchaseStatus: 'none',
        });

      newOrdersCount++;
    }

    // 根据Ozon官方API，只有"已准备发运"状态（awaiting_deliver）才创建采购需求
    // awaiting_packaging（等待打包）状态不需要创建采购需求
    const awaitingDeliverStatuses = ['awaiting_deliver', 'awaiting-deliver'];
    if (awaitingDeliverStatuses.includes(posting.status)) {
      for (const product of posting.products) {
        const priority = calculatePriority(shipmentDeadline ? new Date(shipmentDeadline) : null);

        try {
          await db.execute(sql`
            INSERT INTO purchase_demands (order_id, sku, product_name, quantity, priority, status)
            VALUES (${orderUuid}, ${product.sku}, ${product.name}, ${product.quantity}, ${priority}, 'pending')
          `);

          newDemandsCount++;
        } catch (demandError) {
          // 记录错误但不中断，继续处理
          console.error(`[OrderSync] 插入采购需求失败 (订单 ${posting.order_id}, SKU ${product.sku}):`, demandError);
        }
      }
    }
  }

  return { orders: newOrdersCount, demands: newDemandsCount, updated: updatedOrdersCount };
}

// ============================================================================
// 批量同步
// ============================================================================

/**
 * 同步所有活跃店铺的订单
 */
export async function syncAllShops(): Promise<BatchSyncResult> {
  const result: BatchSyncResult = {
    success: true,
    syncedShops: 0,
    failedShops: 0,
    newOrders: 0,
    updatedOrders: 0,
    newDemands: 0,
    shopResults: [],
    errors: [],
  };

  // 获取所有活跃店铺
  const activeShops = await db
    .select({
      id: shops.id,
      name: shops.name,
      // 优先使用 ozonClientId/ozonApiKey（加密字段），回退到 clientId/apiKey（明文字段）
      ozonClientId: sql<string>`COALESCE(${shops.ozonClientId}, ${shops.clientId})`,
      clientId: shops.clientId,
      apiKey: shops.apiKey,
      ozonApiKey: shops.ozonApiKey,
    })
    .from(shops)
    .where(eq(shops.isActive, true));

  if (activeShops.length === 0) {
    console.log('[OrderSync] 没有找到活跃店铺');
    return result;
  }

  // 按顺序同步每个店铺（单个失败不影响其他）
  for (const shop of activeShops) {
    // 优先使用 ozon_client_id，回退到 client_id（查询已用COALESCE合并）
    const encryptedKey = shop.ozonApiKey as string | null;
    const plainKey = shop.apiKey as string | null;

    // 获取有效的 ClientId（优先 ozonClientId，回退 clientId）
    const clientId = (shop.ozonClientId as string) || (shop.clientId as string);
    if (!clientId || (!encryptedKey && !plainKey)) {
      result.errors.push({
        shopId: shop.id,
        shopName: shop.name || '未知店铺',
        error: '缺少 ClientId 或 API Key',
      });
      result.failedShops++;
      continue;
    }

    // 解密 API Key（优先加密字段，回退明文）
    let decryptedApiKey: string;
    try {
      const raw = encryptedKey || plainKey;
      decryptedApiKey = (raw as string).includes(':') ? decrypt(raw as string) : raw as string;
    } catch {
      result.errors.push({
        shopId: shop.id,
        shopName: shop.name || '未知店铺',
        error: 'API密钥解密失败',
      });
      result.failedShops++;
      continue;
    }

    const shopResult = await syncOrdersForShop({
      id: shop.id,
      name: shop.name || '未知店铺',
      clientId: clientId,
      apiKey: decryptedApiKey,
    });

    result.shopResults.push(shopResult);

    if (shopResult.success) {
      result.syncedShops++;
      result.newOrders += shopResult.newOrders;
      result.updatedOrders += shopResult.updatedOrders;
      result.newDemands += shopResult.newDemands;
    } else {
      result.failedShops++;
      result.errors.push({
        shopId: shop.id,
        shopName: shop.name,
        error: shopResult.errors.join('; '),
      });
    }
  }

  result.success = result.failedShops === 0;
  
  console.log(`[OrderSync] 同步完成: ${result.syncedShops}成功, ${result.failedShops}失败, 新订单${result.newOrders}, 更新${result.updatedOrders}, 新需求${result.newDemands}`);

  return result;
}

/**
 * 获取店铺同步状态
 */
export async function getShopSyncStatuses(): Promise<ShopSyncStatus[]> {
  const statuses: ShopSyncStatus[] = [];

  const shopOrderStats = await db
    .select({
      shopId: orders.shopId,
      shopName: shops.name,
      lastSyncedAt: sql<Date>`MAX(${orders.lastSyncedAt})`.as('last_synced_at'),
      newOrders: sql<number>`COUNT(*) FILTER (WHERE ${orders.lastSyncedAt} > NOW() - INTERVAL '5 minutes')`.as('new_orders'),
      updatedOrders: sql<number>`0`.as('updated_orders'),
    })
    .from(orders)
    .leftJoin(shops, eq(orders.shopId, shops.id))
    .groupBy(orders.shopId, shops.name);

  for (const order of shopOrderStats) {
    statuses.push({
      shopId: order.shopId,
      shopName: order.shopName || 'Unknown',
      lastSyncAt: order.lastSyncedAt || null,
      status: order.lastSyncedAt ? 'success' : 'never',
      newOrders: Number(order.newOrders) || 0,
      updatedOrders: 0,
    });
  }

  return statuses;
}
