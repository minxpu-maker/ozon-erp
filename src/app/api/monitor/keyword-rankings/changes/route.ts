import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { sql } from 'drizzle-orm';

// 获取排名变动汇总
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '7');
    const monitorItemId = searchParams.get('monitorItemId');

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    let whereClause = `WHERE mkr.captured_at >= '${startDate.toISOString()}'`;
    
    if (monitorItemId) {
      whereClause += ` AND mkr.monitor_item_id = ${parseInt(monitorItemId)}`;
    }

    // 获取所有排名数据
    const query = `
      SELECT 
        mkr.id,
        mkr.keyword,
        mkr.rank_position,
        mkr.page,
        mkr.captured_at,
        mkr.monitor_item_id,
        ms.ozon_product_id,
        ms.product_title,
        ms.image_url,
        ms.current_price
      FROM monitor_keyword_rankings mkr
      LEFT JOIN monitor_items mi ON mkr.monitor_item_id = mi.id
      LEFT JOIN market_signals ms ON mi.signal_id = ms.id
      ${whereClause}
      ORDER BY mkr.keyword, mkr.captured_at ASC
    `;

    const result = await db.execute(sql`${sql.raw(query)}`);
    const rows = (result as any).rows || [];

    // 按关键词分组，计算排名变化
    const keywordMap = new Map<string, any[]>();
    
    rows.forEach((record: any) => {
      const key = record.keyword.toLowerCase();
      if (!keywordMap.has(key)) {
        keywordMap.set(key, []);
      }
      keywordMap.get(key)!.push(record);
    });

    const changes = [];
    let improved = 0;
    let declined = 0;

    for (const [keyword, records] of keywordMap) {
      if (records.length < 2) continue;

      // 获取最早的记录和最新的记录
      const oldest = records[0];
      const newest = records[records.length - 1];

      // 跳过没有排名数据的记录
      if (oldest.rank_position === null || newest.rank_position === null) continue;

      const oldRank = oldest.rank_position;
      const newRank = newest.rank_position;
      const change = oldRank - newRank; // 正数表示排名上升（数字变小）

      // 只显示有变化的
      if (change === 0) continue;

      if (change > 0) improved++;
      else declined++;

      changes.push({
        keyword: newest.keyword,
        oldRank,
        newRank,
        change,
        changeType: change > 0 ? 'up' : 'down', // 上升/下降
        pagesDiff: oldest.page !== null && newest.page !== null 
          ? oldest.page - newest.page 
          : null,
        productTitle: newest.product_title || '',
        productId: newest.ozon_product_id || '',
        productImage: newest.image_url || '',
        currentPrice: newest.current_price || null,
        firstSeen: oldest.captured_at,
        lastSeen: newest.captured_at,
        dataPoints: records.length
      });
    }

    // 按变化排序：下降的排在前面
    changes.sort((a, b) => {
      if (a.changeType !== b.changeType) {
        return a.changeType === 'down' ? -1 : 1;
      }
      return Math.abs(b.change) - Math.abs(a.change);
    });

    // 计算统计
    const summary = {
      totalKeywords: keywordMap.size,
      improved,
      declined,
      unchanged: 0,
      totalChanges: changes.length
    };

    return NextResponse.json({
      success: true,
      data: changes,
      summary
    });
  } catch (error) {
    console.error('获取排名变动失败:', error);
    return NextResponse.json({ error: '获取失败' }, { status: 500 });
  }
}
