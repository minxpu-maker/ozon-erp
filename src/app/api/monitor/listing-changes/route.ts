import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/storage/database/client';

// Listing变更检测API
// 基于 monitor_snapshots 对比检测多种变更类型

// 从 snapshot_data JSONB 中提取值
function extractValue(snapshotData: any, field: string): any {
  if (!snapshotData) return undefined;
  try {
    const data = typeof snapshotData === 'string' ? JSON.parse(snapshotData) : snapshotData;
    if (data && field in data) {
      return data[field];
    }
    // 尝试从 map 中获取 (drizzle 格式)
    if (data && data.map && field in data.map) {
      return data.map[field];
    }
  } catch (e) {
    // 忽略解析错误
  }
  return undefined;
}

// 从 snapshot_data 中提取价格
function extractPrice(snapshotData: any): number {
  const price = extractValue(snapshotData, 'price');
  return typeof price === 'number' ? price : 0;
}

// 从 snapshot_data 中提取标题
function extractTitle(snapshotData: any): string {
  const title = extractValue(snapshotData, 'productTitle') || extractValue(snapshotData, 'title');
  return typeof title === 'string' ? title : '';
}

// 从 snapshot_data 中提取图片
function extractImage(snapshotData: any): string {
  const image = extractValue(snapshotData, 'imageUrl') || extractValue(snapshotData, 'image_url');
  return typeof image === 'string' ? image : '';
}

// 从 snapshot_data 中提取评分
function extractRating(snapshotData: any): number {
  const rating = extractValue(snapshotData, 'rating');
  return typeof rating === 'number' ? rating : 0;
}

// 从 snapshot_data 中提取评论数
function extractReviewCount(snapshotData: any): number {
  const count = extractValue(snapshotData, 'reviewCount') || extractValue(snapshotData, 'review_count');
  return typeof count === 'number' ? count : 0;
}

// 从 snapshot_data 中提取销量
function extractSales(snapshotData: any): number {
  const sales = extractValue(snapshotData, 'sales') || extractValue(snapshotData, 'salesVolume');
  return typeof sales === 'number' ? sales : 0;
}

export async function GET(request: NextRequest) {
  const client = await pool.connect();
  try {
    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '7');
    const platform = searchParams.get('platform') || 'ozon';
    const limit = parseInt(searchParams.get('limit') || '50');
    const changeType = searchParams.get('changeType'); // 可选：price/title/image/rating/stock/all

    // 计算时间范围
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

    // 获取所有监控快照
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

    interface ListingChange {
      signalId: number;
      productTitle: string;
      imageUrl: string | null;
      changeType: string;
      oldValue: string;
      newValue: string;
      changedAt: string;
      platform: string;
    }

    const changes: ListingChange[] = [];

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
      
      // 1. 检测价格变更
      if (!changeType || changeType === 'all' || changeType === 'price') {
        const price1 = extractPrice(latest.snapshot_data);
        const price2 = extractPrice(previous.snapshot_data);

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

      // 2. 检测标题修改
      if (!changeType || changeType === 'all' || changeType === 'title') {
        const title1 = extractTitle(latest.snapshot_data);
        const title2 = extractTitle(previous.snapshot_data);

        if (title1 && title2 && title1 !== title2) {
          changes.push({
            signalId: latest.signal_id,
            productTitle: '',
            imageUrl: null,
            changeType: 'title',
            oldValue: title2.length > 50 ? title2.substring(0, 50) + '...' : title2,
            newValue: title1.length > 50 ? title1.substring(0, 50) + '...' : title1,
            changedAt: String(previous.captured_at),
            platform: platform,
          });
        }
      }

      // 3. 检测图片更换
      if (!changeType || changeType === 'all' || changeType === 'image') {
        const image1 = extractImage(latest.snapshot_data);
        const image2 = extractImage(previous.snapshot_data);

        if (image1 && image2 && image1 !== image2) {
          changes.push({
            signalId: latest.signal_id,
            productTitle: '',
            imageUrl: null,
            changeType: 'image',
            oldValue: image2.substring(0, 50) + (image2.length > 50 ? '...' : ''),
            newValue: image1.substring(0, 50) + (image1.length > 50 ? '...' : ''),
            changedAt: String(previous.captured_at),
            platform: platform,
          });
        }
      }

      // 4. 检测评分变更
      if (!changeType || changeType === 'all' || changeType === 'rating') {
        const rating1 = extractRating(latest.snapshot_data);
        const rating2 = extractRating(previous.snapshot_data);

        if (rating1 !== rating2 && rating1 > 0 && rating2 > 0) {
          changes.push({
            signalId: latest.signal_id,
            productTitle: '',
            imageUrl: null,
            changeType: 'rating',
            oldValue: rating2.toFixed(2),
            newValue: rating1.toFixed(2),
            changedAt: String(previous.captured_at),
            platform: platform,
          });
        }
      }

      // 5. 检测评论数变更
      if (!changeType || changeType === 'all' || changeType === 'reviewCount') {
        const count1 = extractReviewCount(latest.snapshot_data);
        const count2 = extractReviewCount(previous.snapshot_data);

        if (count1 !== count2 && count1 > 0 && count2 > 0) {
          const changePercent = (((count1 - count2) / count2) * 100).toFixed(1);
          changes.push({
            signalId: latest.signal_id,
            productTitle: '',
            imageUrl: null,
            changeType: 'reviewCount',
            oldValue: String(count2),
            newValue: `${count1} (${Number(changePercent) > 0 ? '+' : ''}${changePercent}%)`,
            changedAt: String(previous.captured_at),
            platform: platform,
          });
        }
      }

      // 6. 检测销量变更
      if (!changeType || changeType === 'all' || changeType === 'sales') {
        const sales1 = extractSales(latest.snapshot_data);
        const sales2 = extractSales(previous.snapshot_data);

        if (sales1 !== sales2 && sales1 > 0 && sales2 > 0) {
          const changePercent = (((sales1 - sales2) / sales2) * 100).toFixed(1);
          changes.push({
            signalId: latest.signal_id,
            productTitle: '',
            imageUrl: null,
            changeType: 'sales',
            oldValue: String(sales2),
            newValue: `${sales1} (${Number(changePercent) > 0 ? '+' : ''}${changePercent}%)`,
            changedAt: String(previous.captured_at),
            platform: platform,
          });
        }
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

    // 按类型分组统计
    const stats = {
      total: limitedChanges.length,
      byType: {
        price: limitedChanges.filter(c => c.changeType === 'price').length,
        title: limitedChanges.filter(c => c.changeType === 'title').length,
        image: limitedChanges.filter(c => c.changeType === 'image').length,
        rating: limitedChanges.filter(c => c.changeType === 'rating').length,
        reviewCount: limitedChanges.filter(c => c.changeType === 'reviewCount').length,
        sales: limitedChanges.filter(c => c.changeType === 'sales').length,
      }
    };

    return NextResponse.json({
      success: true,
      data: limitedChanges,
      total: limitedChanges.length,
      stats,
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
