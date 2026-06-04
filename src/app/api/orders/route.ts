import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { orders, orderItems, shops, orderSyncLogs, purchaseTasks, ozonProducts } from '@/storage/database/shared/schema';
import { eq, desc, and, gte, lte, like, or, inArray } from 'drizzle-orm';
import { OzonApiClient } from '@/lib/ozon/client';
import { rateLimiter, getRateLimitHeaders } from '@/lib/rate-limit/rate-limiter';
import { cache } from '@/lib/cache/memory-cache';

// 订单列表缓存时间：30秒
const ORDERS_CACHE_TTL = 30;

// GET /api/orders - 获取订单列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');
    const shopId = searchParams.get('shopId');
    const search = searchParams.get('search');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // 生成缓存key（仅对无搜索条件的请求缓存）
    const shouldCache = !search && page === 1;
    const cacheKey = shouldCache ? `orders:list:${status || 'all'}:${shopId || 'all'}` : null;
    
    // 尝试从缓存获取
    if (cacheKey) {
      const cachedData = cache.get(cacheKey);
      if (cachedData) {
        return NextResponse.json({ success: true, data: cachedData, cached: true });
      }
    }

    // 构建查询条件
    const conditions = [];
    if (status && status !== 'all') {
      conditions.push(eq(orders.status, status));
    }
    if (shopId) {
      conditions.push(eq(orders.shop_id, shopId));
    }
    if (startDate) {
      conditions.push(gte(orders.created_at, new Date(startDate)));
    }
    if (endDate) {
      conditions.push(lte(orders.created_at, new Date(endDate)));
    }
    if (search) {
      conditions.push(
        or(
          like(orders.ozon_order_id, `%${search}%`),
          like(orders.ozon_posting_number, `%${search}%`),
          like(orders.buyer_name, `%${search}%`)
        )
      );
    }

    // 查询订单列表
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    const orderList = await db
      .select()
      .from(orders)
      .where(whereClause)
      .orderBy(desc(orders.created_at))
      .limit(limit)
      .offset((page - 1) * limit);

    // 查询总数
    const countResult = await db
      .select({ id: orders.id })
      .from(orders)
      .where(whereClause);
    
    const total = countResult.length;

    // 查询关联的店铺信息
    const shopIds = [...new Set(orderList.map(o => o.shop_id))];
    const shopList = shopIds.length > 0 
      ? await db.select().from(shops).where(inArray(shops.id, shopIds))
      : [];
    
    const shopMap = new Map(shopList.map(s => [s.id, s]));

    // 查询关联的商品信息（用于获取图片）
    const offerIds = new Set<string>();
    orderList.forEach(order => {
      const rawData = order.ozon_raw_data as Record<string, unknown> | null;
      const products = rawData?.products as Array<{ offer_id: string }> | undefined;
      if (products) {
        products.forEach(p => {
          if (p.offer_id) offerIds.add(p.offer_id);
        });
      }
    });

    let productMap = new Map<string, { mainImage: string | null; name: string }>();
    if (offerIds.size > 0) {
      const productList = await db
        .select()
        .from(ozonProducts)
        .where(inArray(ozonProducts.offer_id, [...offerIds]));
      
      productList.forEach(p => {
        productMap.set(p.offer_id, {
          mainImage: p.main_image,
          name: p.name,
        });
      });
    }

    // 组装返回数据
    const result = orderList.map(order => {
      // 解析商品信息
      const rawData = order.ozon_raw_data as Record<string, unknown> | null;
      const rawProducts = rawData?.products as Array<{
        sku: number;
        name: string;
        offer_id: string;
        quantity: number;
        price: string;
      }> | undefined;
      
      const products = rawProducts ? rawProducts.map(p => ({
        sku: p.sku,
        name: p.name,
        offerId: p.offer_id,
        quantity: p.quantity,
        price: p.price,
        image: productMap.get(p.offer_id)?.mainImage || null,
      })) : [];

      return {
        id: order.id,
        ozonOrderId: order.ozon_order_id,
        postingNumber: order.ozon_posting_number,
        shopId: order.shop_id,
        shopName: shopMap.get(order.shop_id)?.name || '',
        status: order.status,
        buyerName: order.buyer_name,
        buyerPhone: order.buyer_phone,
        recipientName: order.recipient_name,
        recipientCity: order.recipient_city,
        totalPrice: order.total_price,
        trackingNumber: order.tracking_number,
        isPurchaseBound: order.is_purchase_bound,
        isInspected: order.is_inspected,
        isPacked: order.is_packed,
        isSettled: order.is_settled,
        createdAt: order.created_at,
        ozonCreatedAt: order.ozon_created_at,
        shippedAt: order.shipped_at,
        products,
      };
    });

    const responseData = {
      orders: result,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };

    // 存入缓存
    if (cacheKey) {
      cache.set(cacheKey, responseData, ORDERS_CACHE_TTL);
    }

    return NextResponse.json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error('获取订单列表失败:', error);
    return NextResponse.json(
      { success: false, error: '获取订单列表失败' },
      { status: 500 }
    );
  }
}

// POST /api/orders - 同步订单
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, shopId } = body;

    if (action === 'sync') {
      // 限流检查：每分钟最多5次同步
      const rateLimitResult = rateLimiter.check('orders:sync');
      if (!rateLimitResult.allowed) {
        return NextResponse.json(
          { 
            success: false, 
            error: '同步频率过高，请稍后再试',
            resetAt: rateLimitResult.resetAt,
          },
          { 
            status: 429,
            headers: getRateLimitHeaders(rateLimitResult),
          }
        );
      }

      // 同步指定店铺或所有活跃店铺的订单
      const shopList = shopId
        ? await db.select().from(shops).where(eq(shops.id, shopId))
        : await db.select().from(shops).where(eq(shops.is_active, true));

      if (shopList.length === 0) {
        return NextResponse.json(
          { success: false, error: '未找到可同步的店铺' },
          { status: 400 }
        );
      }

      const results = [];
      for (const shop of shopList) {
        try {
          const client = new OzonApiClient({
            clientId: shop.client_id,
            apiKey: shop.api_key,
          });
          
          // 计算时间范围：最近30天
          const now = new Date();
          const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          const sinceStr = since.toISOString();
          const toStr = now.toISOString();
          
          // 获取最近30天的订单（不限制状态）
          const response = await client.getFbsOrders({
            filter: {
              since: sinceStr,
              to: toStr,
            },
            limit: 100,
          });

          const postings = response.result?.postings || [];
          let created = 0;
          let updated = 0;

          for (const posting of postings) {
            // 获取订单详情
            const detailResponse = await client.getFbsOrder(posting.posting_number);
            
            const orderData = detailResponse.result;
            if (!orderData) continue;

            // 检查订单是否已存在
            const existing = await db
              .select()
              .from(orders)
              .where(eq(orders.ozon_posting_number, posting.posting_number))
              .limit(1);

            // 获取Ozon订单状态
            const ozonStatus = posting.status || 'unknown';
            
            // 计算订单金额
            let totalPrice = 0;
            let productsPrice = 0;
            let deliveryPrice = 0;
            
            // Ozon API返回的商品在 products 数组中，不在 items 中
            // 从 products 数组计算商品总价
            if (orderData.products && Array.isArray(orderData.products)) {
              for (const product of orderData.products) {
                // price 是字符串格式 "12.0000"
                const productPrice = typeof product.price === 'string' 
                  ? parseFloat(product.price) 
                  : (product.price || 0);
                const quantity = product.quantity || 1;
                productsPrice += productPrice * quantity;
              }
            }
            
            // 从 financial_data 获取更准确的价格信息（如果有）
            if (orderData.financial_data?.products && Array.isArray(orderData.financial_data.products)) {
              let financialPrice = 0;
              for (const fp of orderData.financial_data.products) {
                // customer_price 是客户实际支付的价格（卢布）
                const price = fp.customer_price || fp.price || 0;
                const qty = fp.quantity || 1;
                financialPrice += price * qty;
              }
              // 如果 financial_data 有价格，优先使用
              if (financialPrice > 0) {
                productsPrice = financialPrice;
              }
            }
            
            // 从 delivery_price 获取运费
            if (orderData.delivery_price) {
              deliveryPrice = parseFloat(orderData.delivery_price) || 0;
            }

            // 总价 = 商品价格
            totalPrice = productsPrice;

            const orderRecord = {
              ozon_order_id: orderData.order_id?.toString() || '',
              ozon_posting_number: posting.posting_number,
              shop_id: shop.id,
              status: ozonStatus,
              buyer_name: orderData.customer?.name || null,
              buyer_phone: orderData.customer?.phone || null,
              recipient_name: orderData.address?.recipient || null,
              recipient_phone: orderData.address?.phone || null,
              recipient_city: orderData.address?.city || null,
              recipient_address: orderData.address?.address_line || null,
              total_price: totalPrice.toFixed(2),
              products_price: productsPrice.toFixed(2),
              delivery_price: deliveryPrice.toFixed(2),
              ozon_raw_data: orderData,
              ozon_created_at: orderData.in_process_at ? new Date(orderData.in_process_at) : (orderData.created_at ? new Date(orderData.created_at) : null),
              ozon_updated_at: orderData.status_updated_at ? new Date(orderData.status_updated_at) : (orderData.in_process_at ? new Date(orderData.in_process_at) : null),
              updated_at: new Date(),
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
              const [newOrder] = await db.insert(orders).values({
                ...orderRecord,
                created_at: new Date(),
              }).returning({ id: orders.id });
              orderId = newOrder.id;
              created++;
            }

            // 处理订单商品和采购任务
            if (orderData.products && Array.isArray(orderData.products)) {
              for (const product of orderData.products) {
                const productPrice = typeof product.price === 'string' 
                  ? parseFloat(product.price) 
                  : (product.price || 0);
                const quantity = product.quantity || 1;
                
                // 检查订单商品是否已存在
                const existingItem = await db
                  .select()
                  .from(orderItems)
                  .where(and(
                    eq(orderItems.order_id, orderId),
                    eq(orderItems.sku, product.offer_id || product.name || 'unknown')
                  ))
                  .limit(1);

                let orderItemId: string;
                if (existingItem.length > 0) {
                  await db
                    .update(orderItems)
                    .set({
                      name: product.name || existingItem[0].name,
                      quantity: quantity,
                      price: productPrice.toFixed(2),
                      ozon_offer_id: product.offer_id || null,
                      updated_at: new Date(),
                    })
                    .where(eq(orderItems.id, existingItem[0].id));
                  orderItemId = existingItem[0].id;
                } else {
                  const [newItem] = await db.insert(orderItems).values({
                    order_id: orderId,
                    sku: product.offer_id || product.name || 'unknown',
                    name: product.name || 'Unknown Product',
                    quantity: quantity,
                    price: productPrice.toFixed(2),
                    ozon_offer_id: product.offer_id || null,
                  }).returning({ id: orderItems.id });
                  orderItemId = newItem.id;
                }

                // 如果订单状态是"待发货"，自动创建采购任务
                if (ozonStatus === 'awaiting_deliver') {
                  // 检查是否已存在采购任务
                  const existingTask = await db
                    .select()
                    .from(purchaseTasks)
                    .where(eq(purchaseTasks.order_item_id, orderItemId))
                    .limit(1);

                  if (existingTask.length === 0) {
                    // 创建采购任务
                    await db.insert(purchaseTasks).values({
                      order_id: orderId,
                      order_item_id: orderItemId,
                      status: 'pending',
                      sku_code: product.offer_id || product.name || 'unknown',
                      quantity: quantity,
                    });
                  }
                }
              }
            }
          }

          // 更新店铺最后同步时间
          await db
            .update(shops)
            .set({ last_sync_at: new Date(), updated_at: new Date() })
            .where(eq(shops.id, shop.id));

          results.push({
            shopId: shop.id,
            shopName: shop.name,
            success: true,
            fetched: postings.length,
            created,
            updated,
          });
        } catch (err) {
          results.push({
            shopId: shop.id,
            shopName: shop.name,
            success: false,
            error: err instanceof Error ? err.message : '同步失败',
          });
        }
      }

      return NextResponse.json({
        success: true,
        data: { results },
      });
    }

    return NextResponse.json(
      { success: false, error: '未知操作' },
      { status: 400 }
    );
  } catch (error) {
    console.error('订单同步失败:', error);
    return NextResponse.json(
      { success: false, error: '订单同步失败' },
      { status: 500 }
    );
  }
}
