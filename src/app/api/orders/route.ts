import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/storage/database/client';

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
    const ordersResult = await pool.query(`
      SELECT 
        o.id, o.ozon_posting_number, o.erp_status, o.shipment_deadline,
        o.buyer_name, o.recipient_address, o.recipient_city, o.total_price, o.status,
        o.is_inspected, o.is_packed, o.created_at, o.updated_at,
        o.shop_id, o.purchase_price, o.tracking_number, o.is_purchase_bound,
        o.ozon_raw_data, s.name as shop_name
      FROM orders o
      LEFT JOIN shops s ON o.shop_id = s.id
      ${whereClause}
      ORDER BY o.created_at DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `);
    const orders = ordersResult.rows || [];

    // Format response
    const formattedOrders = orders.map((o: any) => {
      // 解析 ozon_raw_data 中的商品信息
      let products: any[] = [];
      try {
        const rawData = o.ozon_raw_data;
        if (rawData && typeof rawData === 'object') {
          // 从 products 数组中提取商品信息
          const rawProducts = rawData.products || rawData.financial_data?.products || [];
          if (Array.isArray(rawProducts)) {
            products = rawProducts.map((p: any) => ({
              name: p.name || '未知商品',
              sku: String(p.sku || p.offer_id || ''),
              quantity: Number(p.quantity) || 1,
              price: String(p.price || 0),
              image: p.image_url || null,
            }));
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
        shipmentDeadline: o.shipment_deadline,
        buyerName: o.buyer_name,
        recipientName: o.recipient_name,
        recipientCity: o.recipient_city,
        totalPrice: o.total_price,
        orderAmount: o.total_price,
        status: o.status,
        ozonStatus: ozonStatusMap[o.status] || o.status,
        isInspected: o.is_inspected,
        isPacked: o.is_packed,
        isPurchaseBound: o.is_purchase_bound,
        createdAt: o.created_at,
        updatedAt: o.updated_at,
        lastSyncedAt: o.updated_at,
        shopId: o.shop_id,
        shopName: o.shop_name,
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
