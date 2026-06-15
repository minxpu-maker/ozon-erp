import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/storage/database/client';

// Listing变更检测API
// 基于 monitor_snapshots 对比检测：价格变动

// 从 snapshot_data JSONB 中提取价格
function extractPrice(snapshotData: any): number {
  if (!snapshotData) return 0;
  try {
    // snapshotData 可能是字符串化的 JSON 或对象
    const data = typeof snapshotData === 'string' ? JSON.parse(snapshotData) : snapshotData;
    if (data && typeof data.price === 'number') {
      return data.price;
    }
    // 尝试从 map 中获取 (drizzle 格式)
    if (data && data.map && typeof data.map.price === 'number') {
      return data.map.price;
    }
  } catch (e) {
    // 忽略解析错误
  }
  return 0;
}

export async function GET(request: NextRequest) {
  const client = await pool.connect();
  try {
    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '7');
    const platform = searchParams.get('platform') || 'ozon';
    const limit = parseInt(searchParams.get('limit') || '50');

    // 计算时间范围
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

    // 获取所有监控快照（不按平台过滤，因为market_signals没有platform字段）
    const result = await client.query(`
      SELECT 
        ms.monitor_item_id,
        ms.id as snapshot_id,
        ms.snapshot_data,
        ms.captured_at,
        mi.signal_id
      FROM monitor_snapshots ms
      INNER JOIN monitor_items mi ON ms.monitor_item_id = mi.id
      WHERE ms.captured_at >= $1
      ORDER BY ms.monitor_item_id, ms.captured_at DESC
    `, [startDate.toISOString()]);

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        total: 0,
        days,
        platform,
      });
    }

    // 去重：只保留每个监控项的最新快照
    const latestByItem = new Map<number, any>();
    for (const row of result.rows) {
      const itemId = row.monitor_item_id;
      if (!latestByItem.has(itemId)) {
        latestByItem.set(itemId, row);
      }
    }

    const changes: Array<{
      signalId: number;
      productTitle: string;
      imageUrl: string | null;
      changeType: string;
      oldValue: string;
      newValue: string;
      changedAt: string;
      platform: string;
    }> = [];

    // 对每个监控项，获取次新快照进行对比
    for (const [_, latest] of latestByItem) {
      // 获取次新快照
      const prevResult = await client.query(`
        SELECT 
          ms.id,
          ms.snapshot_data,
          ms.captured_at
        FROM monitor_snapshots ms
        WHERE ms.monitor_item_id = $1
          AND ms.id != $2
          AND ms.captured_at < $3
        ORDER BY ms.captured_at DESC
        LIMIT 1
      `, [latest.monitor_item_id, latest.snapshot_id, latest.captured_at]);

      if (prevResult.rows.length === 0) continue;

      const previous = prevResult.rows[0];
      
      // 从 snapshot_data 中提取价格
      const price1 = extractPrice(latest.snapshot_data);
      const price2 = extractPrice(previous.snapshot_data);

      // 检测价格变更
      if (price1 !== price2 && price1 > 0 && price2 > 0) {
        const changePercent = (((price1 - price2) / price2) * 100).toFixed(1);
        changes.push({
          signalId: latest.signal_id,
          productTitle: '',
          imageUrl: null,
          changeType: 'price',
          oldValue: `${price2}`,
          newValue: `${price1} (${Number(changePercent) > 0 ? '+' : ''}${changePercent}%)`,
          changedAt: String(previous.captured_at),
          platform: platform,
        });
      }
    }

    // 获取商品信息
    if (changes.length > 0) {
      const signalIds = changes.map(c => c.signalId);
      const productsResult = await client.query(`
        SELECT id, product_title, image_url
        FROM market_signals
        WHERE id = ANY($1)
      `, [signalIds]);

      const productMap = new Map(productsResult.rows.map((p: any) => [p.id, p]));

      for (const change of changes) {
        const product = productMap.get(change.signalId);
        if (product) {
          change.productTitle = product.product_title || '';
          change.imageUrl = product.image_url || null;
        }
      }
    }

    // 按时间排序并限制数量
    changes.sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime());
    const limitedChanges = changes.slice(0, limit);

    return NextResponse.json({
      success: true,
      data: limitedChanges,
      total: limitedChanges.length,
      days,
      platform,
    });

  } catch (error) {
    console.error('Listing变更查询失败:', error);
    const err = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: '查询失败: ' + err },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
