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

// GET /api/monitor/items/[id] - 获取监控项详情和变更记录
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const includeChanges = searchParams.get('includeChanges') === 'true';
    const changesLimit = parseInt(searchParams.get('changesLimit') || '30');

    // 查询监控项详情
    const item = await executeQuery(`
      SELECT mi.*, 
             ms.product_title,
             ms.image_url,
             ms.current_price,
             ms.monthly_sales as current_sales,
             ms.rating as current_rating,
             ms.reviews_count as current_review_count,
             ms.stock as current_stock,
             ms.captured_at as last_snapshot_at
      FROM monitor_items mi
      LEFT JOIN market_signals ms ON mi.signal_id = ms.id
      WHERE mi.id = $1
    `, [parseInt(id)]);

    if (item.length === 0) {
      return NextResponse.json({ success: false, error: '监控项不存在' }, { status: 404 });
    }

    const monitorItem = item[0];
    let changes: any[] = [];

    if (includeChanges) {
      // 查询最近的快照
      const snapshots = await executeQuery(`
        SELECT * FROM monitor_snapshots
        WHERE monitor_item_id = $1
        ORDER BY captured_at DESC
        LIMIT $2
      `, [parseInt(id), changesLimit]);

      // 计算变更
      for (let i = 0; i < snapshots.length - 1; i++) {
        const current = snapshots[i];
        const previous = snapshots[i + 1];

        const priceChange = previous.price > 0
          ? ((current.price - previous.price) / previous.price * 100).toFixed(2)
          : null;
        const salesChange = current.sales - previous.sales;

        changes.push({
          snapshotId: current.id,
          capturedAt: current.captured_at,
          price: current.price,
          previousPrice: previous.price,
          priceChange: priceChange ? parseFloat(priceChange) : null,
          sales: current.sales,
          previousSales: previous.sales,
          salesChange,
          rating: current.rating,
          reviewCount: current.review_count,
          stock: current.stock,
          snapshotData: current.snapshot_data
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        id: monitorItem.id,
        signalId: monitorItem.signal_id,
        monitorType: monitorItem.monitor_type,
        status: monitorItem.status,
        productTitle: monitorItem.product_title,
        imageUrl: monitorItem.image_url,
        currentPrice: monitorItem.current_price,
        currentSales: monitorItem.current_sales,
        currentRating: monitorItem.current_rating,
        currentReviewCount: monitorItem.current_review_count,
        currentStock: monitorItem.current_stock,
        lastSnapshotAt: monitorItem.last_snapshot_at,
        createdAt: monitorItem.created_at,
        changes
      }
    });
  } catch (error) {
    console.error('获取监控项详情失败:', error);
    return NextResponse.json({ success: false, error: '获取监控项详情失败' }, { status: 500 });
  }
}

// PUT /api/monitor/items/[id] - 更新监控状态
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    if (!status || !['active', 'paused', 'removed'].includes(status)) {
      return NextResponse.json({ success: false, error: '无效的status值' }, { status: 400 });
    }

    await executeQuery(
      `UPDATE monitor_items SET status = $1 WHERE id = $2`,
      [status, parseInt(id)]
    );

    return NextResponse.json({ success: true, message: '更新成功' });
  } catch (error) {
    console.error('更新监控项失败:', error);
    return NextResponse.json({ success: false, error: '更新监控项失败' }, { status: 500 });
  }
}

// DELETE /api/monitor/items/[id] - 删除监控项
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 软删除：更新状态为removed
    await executeQuery(
      `UPDATE monitor_items SET status = 'removed' WHERE id = $1`,
      [parseInt(id)]
    );

    return NextResponse.json({ success: true, message: '监控项已删除' });
  } catch (error) {
    console.error('删除监控项失败:', error);
    return NextResponse.json({ success: false, error: '删除监控项失败' }, { status: 500 });
  }
}
