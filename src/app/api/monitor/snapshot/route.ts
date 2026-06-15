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

// POST /api/monitor/snapshot - 推送监控快照
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      monitorItemId,
      signalId,
      price,
      sales,
      rating,
      reviewCount,
      stock,
      snapshotData
    } = body;

    // 获取或创建监控项
    let itemId = monitorItemId;
    
    if (!itemId && signalId) {
      // 查找是否存在监控项
      const existing = await executeQuery(
        `SELECT id FROM monitor_items WHERE signal_id = $1 AND monitor_type = 'product' AND status = 'active'`,
        [signalId]
      );

      if (existing.length > 0) {
        itemId = existing[0].id;
      } else {
        // 自动创建监控项
        const newItem = await executeQuery(
          `INSERT INTO monitor_items (signal_id, monitor_type, status) VALUES ($1, 'product', 'active') RETURNING id`,
          [signalId]
        );
        itemId = newItem[0]?.id;
      }
    }

    if (!itemId) {
      return NextResponse.json({ success: false, error: '缺少monitorItemId或signalId' }, { status: 400 });
    }

    // 获取上一个快照用于计算变化
    const lastSnapshot = await executeQuery(
      `SELECT price, sales FROM monitor_snapshots WHERE monitor_item_id = $1 ORDER BY captured_at DESC LIMIT 1`,
      [itemId]
    );

    // 插入新快照
    const result = await executeQuery(
      `INSERT INTO monitor_snapshots (monitor_item_id, price, sales, rating, review_count, stock, snapshot_data) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING id, captured_at`,
      [itemId, price || null, sales || null, rating || null, reviewCount || null, stock || null, snapshotData ? JSON.stringify(snapshotData) : null]
    );

    const newSnapshot = result[0];

    // 计算变化
    let priceChange = null;
    let salesChange = null;
    
    if (lastSnapshot.length > 0 && lastSnapshot[0].price && price) {
      priceChange = ((price - lastSnapshot[0].price) / lastSnapshot[0].price * 100).toFixed(2);
    }
    if (lastSnapshot.length > 0 && sales !== undefined) {
      salesChange = (sales || 0) - lastSnapshot[0].sales;
    }

    return NextResponse.json({
      success: true,
      data: {
        snapshotId: newSnapshot?.id,
        monitorItemId: itemId,
        capturedAt: newSnapshot?.captured_at,
        priceChange: priceChange ? parseFloat(priceChange) : null,
        salesChange,
        hasChanged: (priceChange && parseFloat(priceChange) !== 0) || (salesChange && salesChange !== 0)
      }
    });
  } catch (error) {
    console.error('保存快照失败:', error);
    return NextResponse.json({ success: false, error: '保存快照失败' }, { status: 500 });
  }
}

// GET /api/monitor/snapshot - 获取快照历史
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const monitorItemId = searchParams.get('monitorItemId');
    const limit = parseInt(searchParams.get('limit') || '30');

    if (!monitorItemId) {
      return NextResponse.json({ success: false, error: '缺少monitorItemId' }, { status: 400 });
    }

    const snapshots = await executeQuery(
      `SELECT * FROM monitor_snapshots WHERE monitor_item_id = $1 ORDER BY captured_at DESC LIMIT $2`,
      [parseInt(monitorItemId), limit]
    );

    return NextResponse.json({
      success: true,
      data: snapshots.map((s: any) => ({
        id: s.id,
        monitorItemId: s.monitor_item_id,
        price: s.price,
        sales: s.sales,
        rating: s.rating,
        reviewCount: s.review_count,
        stock: s.stock,
        snapshotData: s.snapshot_data,
        capturedAt: s.captured_at
      }))
    });
  } catch (error) {
    console.error('获取快照历史失败:', error);
    return NextResponse.json({ success: false, error: '获取快照历史失败' }, { status: 500 });
  }
}
