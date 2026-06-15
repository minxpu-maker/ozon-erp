import { NextRequest, NextResponse } from 'next/server';
import { db, pool } from '@/storage/database/client';
import { sql } from 'drizzle-orm';

// 辅助函数：直接执行SQL
async function executeQuery(query: string, params: any[] = []) {
  const client = await pool.connect();
  try {
    const result = await client.query(query, params);
    return result.rows;
  } finally {
    client.release();
  }
}

// GET /api/monitor/items - 获取监控列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'product';
    const status = searchParams.get('status') || 'active';
    const limit = parseInt(searchParams.get('limit') || '50');
    const page = parseInt(searchParams.get('page') || '1');
    const offset = (page - 1) * limit;

    // 查询监控项
    const items = await executeQuery(`
      SELECT mi.id, mi.signal_id, mi.monitor_type, mi.status, mi.created_at,
             ms.product_title, ms.image_url, ms.current_price, 
             ms.monthly_sales as current_sales, ms.rating as current_rating,
             ms.reviews_count as current_review_count, ms.stock as current_stock
      FROM monitor_items mi
      LEFT JOIN market_signals ms ON mi.signal_id = ms.id
      WHERE mi.monitor_type = $1 AND mi.status = $2
      ORDER BY mi.created_at DESC
      LIMIT $3 OFFSET $4
    `, [type, status, limit, offset]);

    // 获取总数
    const countResult = await executeQuery(`
      SELECT COUNT(*) as total FROM monitor_items 
      WHERE monitor_type = $1 AND status = $2
    `, [type, status]);

    const total = parseInt(countResult[0]?.total || '0');

    // 计算变化
    const itemsWithChanges = items.map((item: any) => {
      let priceChange = null;
      let salesChange = null;
      
      if (item.current_price && item.previous_price) {
        priceChange = ((item.current_price - item.previous_price) / item.previous_price * 100).toFixed(2);
      }
      if (item.current_sales && item.previous_sales) {
        salesChange = item.current_sales - item.previous_sales;
      }

      return {
        id: item.id,
        signalId: item.signal_id,
        monitorType: item.monitor_type,
        status: item.status,
        productTitle: item.product_title,
        imageUrl: item.image_url,
        currentPrice: item.current_price,
        currentSales: item.current_sales,
        currentRating: item.current_rating,
        currentReviewCount: item.current_review_count,
        currentStock: item.current_stock,
        lastSnapshotAt: item.last_snapshot_at,
        priceChange: priceChange ? parseFloat(priceChange) : null,
        salesChange,
        createdAt: item.created_at,
        hasAlert: (priceChange && parseFloat(priceChange) !== 0) || (salesChange && salesChange !== 0)
      };
    });

    return NextResponse.json({
      success: true,
      data: itemsWithChanges,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('获取监控列表失败:', error);
    return NextResponse.json({ success: false, error: '获取监控列表失败', detail: String(error) }, { status: 500 });
  }
}

// POST /api/monitor/items - 添加监控
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { signalId, type = 'product' } = body;

    if (!signalId) {
      return NextResponse.json({ success: false, error: '缺少signalId' }, { status: 400 });
    }

    // 检查是否已存在
    const existing = await executeQuery(
      `SELECT id FROM monitor_items WHERE signal_id = $1 AND monitor_type = $2 AND status = 'active'`,
      [signalId, type]
    );

    if (existing.length > 0) {
      return NextResponse.json({ success: true, message: '已在监控列表中', data: { id: existing[0].id } });
    }

    // 创建监控项
    const result = await executeQuery(
      `INSERT INTO monitor_items (signal_id, monitor_type, status) VALUES ($1, $2, 'active') RETURNING id, signal_id, monitor_type, status, created_at`,
      [signalId, type]
    );

    const newItem = result[0];

    return NextResponse.json({
      success: true,
      message: '添加成功',
      data: {
        id: newItem.id,
        signalId: newItem.signal_id,
        monitorType: newItem.monitor_type,
        status: newItem.status,
        createdAt: newItem.created_at
      }
    });
  } catch (error) {
    console.error('添加监控失败:', error);
    return NextResponse.json({ success: false, error: '添加监控失败', detail: String(error) }, { status: 500 });
  }
}
