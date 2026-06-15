import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/storage/database/client';

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

// GET /api/monitor/items/[id]/changes - 获取变更记录
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '30');
    const hasChangesOnly = searchParams.get('hasChangesOnly') === 'true';

    // 查询最近的快照
    const snapshots = await executeQuery(`
      SELECT * FROM monitor_snapshots
      WHERE monitor_item_id = $1
      ORDER BY captured_at DESC
      LIMIT $2
    `, [parseInt(id), limit + 1]);

    if (snapshots.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        message: '暂无快照数据'
      });
    }

    // 计算变更
    const changes: any[] = [];
    
    for (let i = 0; i < snapshots.length - 1; i++) {
      const current = snapshots[i];
      const previous = snapshots[i + 1];

      const priceChange = previous.price > 0 && current.price
        ? ((current.price - previous.price) / previous.price * 100).toFixed(2)
        : null;
      const salesChange = current.sales - previous.sales;

      // 如果设置了只看有变化的，过滤掉无变化的
      if (hasChangesOnly) {
        const hasChange = (priceChange && parseFloat(priceChange) !== 0) || salesChange !== 0;
        if (!hasChange) continue;
      }

      changes.push({
        snapshotId: current.id,
        capturedAt: current.captured_at,
        price: current.price,
        previousPrice: previous.price,
        priceChange: priceChange ? parseFloat(priceChange) : null,
        priceDirection: priceChange ? (parseFloat(priceChange) > 0 ? 'up' : 'down') : null,
        sales: current.sales,
        previousSales: previous.sales,
        salesChange,
        salesDirection: salesChange > 0 ? 'up' : salesChange < 0 ? 'down' : null,
        rating: current.rating,
        previousRating: previous.rating,
        ratingChange: current.rating && previous.rating 
          ? (current.rating - previous.rating).toFixed(2) 
          : null,
        reviewCount: current.review_count,
        previousReviewCount: previous.review_count,
        reviewCountChange: current.review_count - previous.review_count,
        stock: current.stock,
        previousStock: previous.stock,
        stockChange: current.stock - previous.stock,
        hasAlert: (priceChange && parseFloat(priceChange) !== 0) || salesChange !== 0
      });
    }

    // 获取监控项信息
    const item = await executeQuery(`
      SELECT mi.*, ms.product_title, ms.image_url
      FROM monitor_items mi
      LEFT JOIN market_signals ms ON mi.signal_id = ms.id
      WHERE mi.id = $1
    `, [parseInt(id)]);

    return NextResponse.json({
      success: true,
      data: changes,
      monitor: item[0] ? {
        id: item[0].id,
        productTitle: item[0].product_title,
        imageUrl: item[0].image_url,
        status: item[0].status,
        createdAt: item[0].created_at
      } : null
    });
  } catch (error) {
    console.error('获取变更记录失败:', error);
    return NextResponse.json({ success: false, error: '获取变更记录失败' }, { status: 500 });
  }
}
