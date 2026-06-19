import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/storage/database/client';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '20')));
    const shopId = searchParams.get('shopId');
    const status = searchParams.get('status');
    const orderId = searchParams.get('orderId');

    // Build WHERE clause
    const conditions: string[] = [];
    if (shopId && shopId !== 'all') {
      conditions.push(`shop_id = '${shopId.replace(/'/g, "''")}'`);
    }
    if (status && status !== 'all') {
      const statusMap: Record<string, string> = {
        pending: 'pending_purchase',
        purchasing: 'purchasing',
        purchased: 'purchased',
        delivering: 'delivering',
        shipped: 'shipped',
        cancelled: 'cancelled',
      };
      const erpStatus = statusMap[status];
      if (erpStatus) {
        conditions.push(`erp_status = '${erpStatus}'`);
      }
    }
    if (orderId) {
      const safe = orderId.replace(/'/g, "''");
      conditions.push(`(ozon_posting_number ILIKE '%${safe}%' OR buyer_name ILIKE '%${safe}%')`);
    }
    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    // Count total
    const countResult = await pool.query(`SELECT COUNT(*) as total FROM orders ${whereClause}`);
    const total = Number(countResult.rows[0]?.total || 0);

    // Get orders
    const offset = (page - 1) * pageSize;
    const ordersResult = await pool.query(`
      SELECT 
        o.id, o.ozon_posting_number, o.erp_status, o.shipment_deadline,
        o.buyer_name, o.recipient_address, o.recipient_city, o.total_price, o.status,
        o.is_inspected, o.is_packed, o.created_at, o.updated_at,
        o.shop_id, o.purchase_price, o.tracking_number, o.is_purchase_bound,
        s.name as shop_name
      FROM orders o
      LEFT JOIN shops s ON o.shop_id = s.id
      ${whereClause}
      ORDER BY o.created_at DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `);
    const orders = ordersResult.rows || [];

    // Format response
    const formattedOrders = orders.map((o: any) => ({
      id: o.id,
      ozonOrderId: o.ozon_order_id || o.id,
      ozonPostingNumber: o.ozon_posting_number,
      erpStatus: o.erp_status,
      shipmentDeadline: o.shipment_deadline,
      buyerName: o.buyer_name,
      recipientName: o.recipient_name,
      recipientCity: o.recipient_city,
      totalPrice: o.total_price,
      orderAmount: o.total_price,
      status: o.status,
      isInspected: o.is_inspected,
      isPacked: o.is_packed,
      isPurchaseBound: o.is_purchase_bound,
      createdAt: o.created_at,
      updatedAt: o.updated_at,
      lastSyncedAt: o.updated_at,
      shopId: o.shop_id,
      shopName: o.shop_name,
      purchaseInfo: o.is_purchase_bound ? {
        platform: null,
        unitPrice: Number(o.purchase_price) || 0,
        quantity: null,
        totalAmount: (Number(o.purchase_price) || 0),
        url: null,
        trackingNumber: o.tracking_number || null,
        note: null,
      } : null,
    }));

    return NextResponse.json({
      success: true,
      orders: formattedOrders,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error('Orders API error:', error);
    return NextResponse.json(
      { success: false, error: '查询失败', detail: String(error) },
      { status: 500 }
    );
  }
}
