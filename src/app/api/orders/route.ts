import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/storage/database/client';
import { OzonClient } from '@/lib/ozon-client';
import { decrypt } from '@/lib/crypto';

// 简单的内存缓存，避免频繁调用Ozon API
const imageCache = new Map<string, { image: string; expireAt: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10分钟缓存

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '20')));
    const shopId = searchParams.get('shopId');
    const status = searchParams.get('status');
    const erpStatus = searchParams.get('erpStatus');
    const orderId = searchParams.get('orderId');
    const keyword = searchParams.get('keyword');
    // 是否返回紧急度分类计数
    const includeUrgencyBreakdown = searchParams.get('includeUrgencyBreakdown') === 'true';

    // Build WHERE clause
    const conditions: string[] = [];
    if (shopId && shopId !== 'all') {
      conditions.push(`shop_id = '${shopId.replace(/'/g, "''")}'`);
    }
    if (status && status !== 'all') {
      // 根据Ozon官方API严格映射：
      // - awaiting_deliver（已准备发运）→ 待采购
      // - awaiting_packaging（等待打包）→ 待打包
      const statusMap: Record<string, string[]> = {
        pending_purchase: ['awaiting_deliver', 'awaiting-deliver'], // 待采购：只有已准备发运
        pending_packaging: ['awaiting_packaging', 'awaiting-packaging'], // 待打包
        purchasing: ['purchasing'],
        purchased: ['purchased'],
        delivering: ['delivering'],
        shipped: ['shipped'],
        cancelled: ['cancelled'],
      };
      const ozonStatuses = statusMap[status];
      if (ozonStatuses) {
        const ozonConditions = ozonStatuses.map(s => `status = '${s}'`).join(' OR ');
        conditions.push(`(${ozonConditions})`);
      }
    }
    if (erpStatus && erpStatus !== 'all') {
      // erpStatus筛选：直接映射到Ozon状态
      const erpStatusMap: Record<string, string[]> = {
        pending_purchase: ['awaiting_deliver', 'awaiting-deliver'], // 已准备发运
        pending_packaging: ['awaiting_packaging', 'awaiting-packaging'], // 等待打包
        cancelled: ['cancelled'],
        shipped_domestic: ['delivering', 'delivered'],
      };
      const ozonStatuses = erpStatusMap[erpStatus];
      if (ozonStatuses) {
        const ozonConditions = ozonStatuses.map(s => `status = '${s}'`).join(' OR ');
        conditions.push(`(${ozonConditions})`);
      }
    }
    if (orderId) {
      const safe = orderId.replace(/'/g, "''");
      conditions.push(`(ozon_posting_number ILIKE '%${safe}%' OR buyer_name ILIKE '%${safe}%')`);
    }
    if (keyword) {
      // keyword搜索：订单号 + products JSON中的sku和name
      const safe = keyword.replace(/'/g, "''");
      conditions.push(`(
        ozon_posting_number ILIKE '%${safe}%'
        OR products::text ILIKE '%${safe}%'
      )`);
    }
    // urgency 筛选：超时/紧急/普通
    const urgency = searchParams.get('urgency');
    if (urgency === 'overdue') {
      conditions.push(`shipment_deadline IS NOT NULL AND shipment_deadline < NOW()`);
    } else if (urgency === 'urgent') {
      conditions.push(`shipment_deadline >= NOW() AND shipment_deadline < NOW() + INTERVAL '24 hours'`);
    } else if (urgency === 'normal') {
      conditions.push(`(shipment_deadline IS NULL OR shipment_deadline >= NOW() + INTERVAL '24 hours')`);
    }
    // timeRange 筛选：今日/3天/7天/30天
    const timeRange = searchParams.get('timeRange');
    if (timeRange === 'today') {
      conditions.push(`created_at >= CURRENT_DATE`);
    } else if (timeRange === '3d') {
      conditions.push(`created_at >= NOW() - INTERVAL '3 days'`);
    } else if (timeRange === '7d') {
      conditions.push(`created_at >= NOW() - INTERVAL '7 days'`);
    } else if (timeRange === '30d') {
      conditions.push(`created_at >= NOW() - INTERVAL '30 days'`);
    }
    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    // Count total
    const countResult = await pool.query(`SELECT COUNT(*) as total FROM orders ${whereClause}`);
    const total = Number(countResult.rows[0]?.total || 0);

    // 紧急度分类计数（仅当请求 includeUrgencyBreakdown=true 时返回）
    let urgencyBreakdown = null;
    if (includeUrgencyBreakdown) {
      // 先去掉 urgency 筛选条件，单独计算各类别
      const urgencyConditions = conditions.filter(c => 
        !c.includes('shipment_deadline') && !c.includes('urgency')
      );
      const urgencyWhereClause = urgencyConditions.length > 0 
        ? 'WHERE ' + urgencyConditions.join(' AND ') 
        : '';
      
      // overdue: shipment_deadline IS NOT NULL AND shipment_deadline < NOW()
      const overdueResult = await pool.query(`
        SELECT COUNT(*) as count FROM orders ${urgencyWhereClause}
        ${urgencyWhereClause ? 'AND' : 'WHERE'} shipment_deadline IS NOT NULL AND shipment_deadline < NOW()
      `);
      
      // urgent: shipment_deadline >= NOW() AND shipment_deadline < NOW() + INTERVAL '48 hours'
      const urgentResult = await pool.query(`
        SELECT COUNT(*) as count FROM orders ${urgencyWhereClause}
        ${urgencyWhereClause ? 'AND' : 'WHERE'} shipment_deadline >= NOW() AND shipment_deadline < NOW() + INTERVAL '48 hours'
      `);
      
      // normal: 其他情况
      const normalResult = await pool.query(`
        SELECT COUNT(*) as count FROM orders ${urgencyWhereClause}
        ${urgencyWhereClause ? 'AND' : 'WHERE'} (shipment_deadline IS NULL OR shipment_deadline >= NOW() + INTERVAL '48 hours')
      `);
      
      urgencyBreakdown = {
        overdue: Number(overdueResult.rows[0]?.count || 0),
        urgent: Number(urgentResult.rows[0]?.count || 0),
        normal: Number(normalResult.rows[0]?.count || 0),
      };
    }

    // Get orders with ozon_raw_data for products
    const offset = (page - 1) * pageSize;
    
    // 首先获取所有店铺的ID到名称映射
    const shopsResult = await pool.query('SELECT id, name FROM shops');
    const shopNameMap = new Map<string, string>();
    for (const s of shopsResult.rows) {
      shopNameMap.set(s.id, s.name);
    }
    
    const ordersResult = await pool.query(`
      SELECT 
        o.id, o.ozon_posting_number, o.erp_status, o.shipment_deadline,
        o.buyer_name, o.recipient_address, o.recipient_city, o.total_price, o.status,
        o.is_inspected, o.is_packed, o.created_at, o.updated_at,
        o.shop_id, o.purchase_price, o.tracking_number, o.is_purchase_bound,
        o.ozon_raw_data, s.ozon_client_id, s.ozon_api_key
      FROM orders o
      LEFT JOIN shops s ON o.shop_id = s.id
      ${whereClause}
      ORDER BY o.created_at DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `);
    const orders = ordersResult.rows || [];

    // 检查是否需要更新订单图片数据（ozon_raw_data中没有images字段的订单）
    // 这里标记需要更新的订单ID，后续可以异步更新
    const ordersNeedUpdate: { id: string; shop_id: string; ozon_posting_number: string }[] = [];
    
    // 收集所有需要获取图片的offer_id（按shop分组）
    const offerIdsByShop = new Map<string, string[]>();
    console.log('[Orders] 开始收集offer_id, 订单数:', orders.length);
    for (const o of orders) {
      try {
        const rawDataObj = (typeof o.ozon_raw_data === 'string') ? JSON.parse(o.ozon_raw_data) : o.ozon_raw_data;
        const products = rawDataObj?.products || [];
        console.log('[Orders] 订单', o.id, 'products数量:', products.length);
        let hasImages = false;
        if (Array.isArray(products)) {
          for (const p of products) {
            const offerId = p.offer_id || p.sku;
            console.log('[Orders] 处理商品, offerId:', offerId, 'shopId:', o.shop_id, 'hasClientId:', !!o.ozon_client_id, 'hasApiKey:', !!o.ozon_api_key);
            // 检查是否有images字段
            if (p.images && Array.isArray(p.images) && p.images.length > 0) {
              hasImages = true;
            }
            if (offerId && o.shop_id && o.ozon_client_id && o.ozon_api_key) {
              const cacheKey = `${o.shop_id}-${offerId}`;
              if (!imageCache.has(cacheKey)) {
                if (!offerIdsByShop.has(o.shop_id)) {
                  offerIdsByShop.set(o.shop_id, []);
                }
                offerIdsByShop.get(o.shop_id)!.push(offerId);
              }
            }
          }
        }
      } catch (e) {}
    }

    // 批量获取商品图片（按shop，通过offer_id）
    for (const [shopId, offerIds] of offerIdsByShop) {
      const shop = orders.find(o => o.shop_id === shopId);
      if (shop && shop.ozon_client_id && shop.ozon_api_key) {
        try {
          // 解密API密钥
          const apiKey = (shop.ozon_api_key as string).includes(':') 
            ? decrypt(shop.ozon_api_key as string) 
            : (shop.ozon_api_key as string);
          const client = new OzonClient({ clientId: shop.ozon_client_id, apiKey });
          console.log('[Orders] 正在获取商品图片, shopId:', shopId, 'offerIds:', offerIds.length);
          const images = await client.getProductImagesByOfferIds(offerIds);
          console.log('[Orders] 获取到图片:', Object.keys(images).length);
          for (const [offerId, imageUrl] of Object.entries(images)) {
            const cacheKey = `${shopId}-${offerId}`;
            imageCache.set(cacheKey, { image: imageUrl, expireAt: Date.now() + CACHE_TTL });
          }
        } catch (e) {
          console.error('[Orders] 获取商品图片失败:', e);
        }
      } else {
        console.log('[Orders] 无法获取图片, shopId:', shopId, 'hasClientId:', !!shop.ozon_client_id, 'hasApiKey:', !!shop.ozon_api_key);
      }
    }

    // 对于没有图片的订单，尝试从Ozon API获取订单详情来更新图片
    // 先收集没有图片的订单ID和对应的posting_number
    const ordersNeedImages: { id: string; shop_id: string; ozon_posting_number: string; ozon_client_id: string; ozon_api_key: string }[] = [];
    for (const o of orders) {
      try {
        const rawDataObj = (typeof o.ozon_raw_data === 'string') ? JSON.parse(o.ozon_raw_data) : o.ozon_raw_data;
        const products = rawDataObj?.products || [];
        if (Array.isArray(products)) {
          let hasImages = false;
          for (const p of products) {
            if (p.images && Array.isArray(p.images) && p.images.length > 0) {
              hasImages = true;
              break;
            }
          }
          // 如果没有图片且有凭证和posting_number，标记需要获取
          if (!hasImages && o.ozon_posting_number && o.ozon_client_id && o.ozon_api_key) {
            ordersNeedImages.push({
              id: o.id,
              shop_id: o.shop_id,
              ozon_posting_number: o.ozon_posting_number,
              ozon_client_id: o.ozon_client_id,
              ozon_api_key: o.ozon_api_key,
            });
          }
        }
      } catch (e) {}
    }
    
    // 异步更新订单图片（不影响返回速度）
    if (ordersNeedImages.length > 0) {
      console.log('[Orders] 需要更新图片的订单数:', ordersNeedImages.length);
      // 按shop分组获取订单详情
      const postingByShop = new Map<string, string[]>();
      for (const order of ordersNeedImages) {
        if (!postingByShop.has(order.shop_id)) {
          postingByShop.set(order.shop_id, []);
        }
        postingByShop.get(order.shop_id)!.push(order.ozon_posting_number);
      }
      
      // 并发获取各shop的订单详情
      const updatePromises: Promise<void>[] = [];
      for (const [shopId, postingNumbers] of postingByShop) {
        const order = ordersNeedImages.find(o => o.shop_id === shopId);
        if (order) {
          const apiKey = (order.ozon_api_key as string).includes(':') 
            ? decrypt(order.ozon_api_key as string) 
            : (order.ozon_api_key as string);
          const client = new OzonClient({ clientId: order.ozon_client_id, apiKey });
          
          updatePromises.push((async () => {
            try {
              for (const postingNumber of postingNumbers) {
                const productImages = await client.getPostingDetails(postingNumber);
                if (Object.keys(productImages).length > 0) {
                  // 更新订单的ozon_raw_data
                  const targetOrder = ordersNeedImages.find(o => o.ozon_posting_number === postingNumber);
                  if (targetOrder) {
                    // 获取现有ozon_raw_data
                    const result = await pool.query('SELECT ozon_raw_data FROM orders WHERE id = $1', [targetOrder.id]);
                    let rawDataObj: any = {};
                    if (result.rows.length > 0) {
                      const rawData = result.rows[0].ozon_raw_data;
                      rawDataObj = (typeof rawData === 'string') ? JSON.parse(rawData) : rawData;
                    }
                    
                    // 合并获取到的图片到products
                    const updatedProducts = rawDataObj.products?.map((existingP: any) => {
                      const imageUrl = productImages[existingP.offer_id];
                      if (imageUrl) {
                        return { ...existingP, image: imageUrl };
                      }
                      return existingP;
                    }) || [];
                    
                    const newRawData = { ...rawDataObj, products: updatedProducts };
                    
                    // 更新数据库
                    await pool.query(
                      'UPDATE orders SET ozon_raw_data = $1, updated_at = NOW() WHERE id = $2',
                      [JSON.stringify(newRawData), targetOrder.id]
                    );
                    console.log('[Orders] 已更新订单图片:', targetOrder.id);
                  }
                }
              }
            } catch (e) {
              console.error('[Orders] 更新订单图片失败:', e);
            }
          })());
        }
      }
      // 不等待完成，让其在后台运行
    }

    // Format response
    const formattedOrders = orders.map((o: any) => {
      // 解析 ozon_raw_data 中的商品信息和收件人信息
      let products: any[] = [];
      let rawDataObj: any = {};
      try {
        rawDataObj = (typeof o.ozon_raw_data === 'string') ? JSON.parse(o.ozon_raw_data) : o.ozon_raw_data;
        if (rawDataObj && typeof rawDataObj === 'object') {
          // 从 products 数组中提取商品信息
          const rawProducts = rawDataObj.products || rawDataObj.financial_data?.products || [];
          if (Array.isArray(rawProducts)) {
            products = rawProducts.map((p: any) => {
              // 尝试从不同位置获取商品重量
              // 1. financial_data.products[].item_services_marketing_data.weight (Ozon俄罗斯)
              // 2. direct weight field
              const weightData = p.item_services_marketing_data?.weight || p.weight || null;
              const productId = Number(p.product_id);
              const offerId = p.offer_id || p.sku;
              // 从多个来源获取图片：1. p.image字段 2. images数组 3. image_url 4. 缓存
              let image: string | null = null;
              // 来源1: 直接从p.image获取（同步时已获取）
              if (!image && p.image) {
                image = p.image;
              }
              // 来源2: 直接从ozon_raw_data的products中获取images数组
              if (!image && p.images && Array.isArray(p.images) && p.images.length > 0) {
                image = p.images[0]; // 取第一张图片
              }
              // 来源3: image_url字段
              if (!image) {
                image = p.image_url || null;
              }
              // 来源3: 从缓存获取
              if (!image && o.shop_id) {
                // 先尝试通过offer_id获取
                if (offerId) {
                  const cacheKeyByOffer = `${o.shop_id}-${offerId}`;
                  const cachedByOffer = imageCache.get(cacheKeyByOffer);
                  if (cachedByOffer && cachedByOffer.expireAt > Date.now()) {
                    image = cachedByOffer.image;
                  }
                }
                // 再尝试通过product_id获取
                if (!image && productId) {
                  const cacheKeyById = `${o.shop_id}-${productId}`;
                  const cachedById = imageCache.get(cacheKeyById);
                  if (cachedById && cachedById.expireAt > Date.now()) {
                    image = cachedById.image;
                  }
                }
                // 来源4: 使用 offer_id 从 Ozon 公开 API 获取图片
                if (!image && offerId) {
                  // Ozon 公开图片 URL 格式（不需要认证）
                  image = `https://ir.ozone.ru/s3/tps/ivcd39q7/300x300/img/ov2/${offerId}.jpg`;
                }
                if (!image) {
                  // 来源5: 使用 ui-avatars.com 生成带有SKU首字母的占位图
                  const skuStr = String(p.sku || p.offer_id || '');
                  if (skuStr) {
                    const initials = skuStr.slice(0, 2).toUpperCase();
                    image = `https://ui-avatars.com/api/?name=${initials}&size=150&background=f0f4f8&color=637089&bold=true`;
                  }
                }
              }
              
              return {
                name: p.name || '未知商品',
                sku: String(p.sku || p.offer_id || ''),
                quantity: Number(p.quantity) || 1,
                price: String(p.price || 0),
                image: image,
                weight: weightData ? Number(weightData) / 1000 : null, // 转换为kg
                productId: productId || null,
              };
            });
          }
        }
      } catch (e) {
        console.error('解析商品信息失败:', e);
      }

      // Ozon状态中文映射
      const ozonStatusMap: Record<string, string> = {
        'awaiting-collecting': '等待揽收',
        'awaiting-deliver': '等待发货',
        'awaiting-packaging': '等待打包',
        'cancelled': '已取消',
        'delivered': '已送达',
        'not_accepted': '未验收',
        'sent': '已发货',
        'refunded': '已退款',
      };

      // 从已有products数组计算总价（卢布）
      // 注意：Ozon后台显示的¥金额就是卢布数的直接显示，不需要汇率转换
      const totalRub = products.reduce((sum: number, p: any) => {
        const price = parseFloat(p.price) || 0;
        const qty = parseInt(p.quantity) || 1;
        return sum + price * qty;
      }, 0);
      // Ozon显示的¥金额 = 卢布数，直接使用
      const totalInCNY = Math.round(totalRub * 100) / 100;
      
      return {
        id: o.id,
        ozonOrderId: o.ozon_order_id || o.id,
        ozonPostingNumber: o.ozon_posting_number,
        erpStatus: (() => {
          // 根据Ozon官方API：
          // awaiting_deliver（已准备发运）→ 待采购 pending_purchase
          // awaiting-packaging（等待打包）→ 待处理 pending
          const awaitingDeliverStatuses = ['awaiting_deliver', 'awaiting-deliver'];
          const awaitingPackagingStatuses = ['awaiting-packaging'];
          const cancelledStatuses = ['cancelled'];
          const deliveringStatuses = ['delivering', 'delivered'];
          
          // 已准备发运 → 待采购
          if (awaitingDeliverStatuses.includes(o.status)) {
            return 'pending_purchase';
          }
          // 等待打包 → 待打包
          if (awaitingPackagingStatuses.includes(o.status)) {
            return 'pending_packaging';
          }
          // 已取消
          if (cancelledStatuses.includes(o.status)) {
            return 'cancelled';
          }
          // 运输中
          if (deliveringStatuses.includes(o.status)) {
            return 'shipped_domestic';
          }
          // 其他状态保持数据库中的状态（如果有的话）
          return o.erp_status || null;
        })(),
        shipmentDeadline: o.shipment_deadline || rawDataObj.shipment_deadline || null,
        buyerName: o.buyer_name,
        recipientName: o.recipient_name || rawDataObj.recipient_name || null,
        recipientCity: o.recipient_city || rawDataObj.recipient_city || null,
        totalPrice: totalInCNY,
        totalPriceRub: totalRub,
        orderAmount: totalInCNY,
        status: o.status,
        ozonStatus: ozonStatusMap[o.status] || o.status,
        isInspected: o.is_inspected,
        isPacked: o.is_packed,
        isPurchaseBound: o.is_purchase_bound,
        createdAt: o.created_at,
        updatedAt: o.updated_at,
        lastSyncedAt: o.updated_at,
        shopId: o.shop_id,
        shopName: shopNameMap.get(o.shop_id) || o.shop_id,
        products, // 添加商品数组
        purchaseInfo: o.is_purchase_bound ? {
          platform: null,
          unitPrice: Number(o.purchase_price) || 0,
          quantity: null,
          totalAmount: (Number(o.purchase_price) || 0),
          url: null,
          trackingNumber: o.tracking_number || null,
          note: null,
        } : null,
      };
    });

    return NextResponse.json({
      success: true,
      orders: formattedOrders,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
      ...(urgencyBreakdown && { urgencyBreakdown }),
    });
  } catch (error) {
    console.error('Orders API error:', error);
    return NextResponse.json(
      { success: false, error: '查询失败', detail: String(error) },
      { status: 500 }
    );
  }
}
