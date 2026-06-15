import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/client';
import { sql } from 'drizzle-orm';

// 获取关键词排名趋势
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const keyword = searchParams.get('keyword');
    const monitorItemId = searchParams.get('monitorItemId');
    const days = parseInt(searchParams.get('days') || '30');

    if (!keyword) {
      return NextResponse.json(
        { error: '缺少参数: keyword' },
        { status: 400 }
      );
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    let whereClause = `WHERE mkr.captured_at >= '${startDate.toISOString()}'`;
    whereClause += ` AND LOWER(mkr.keyword) LIKE LOWER('%${keyword}%')`;
    
    if (monitorItemId) {
      whereClause += ` AND mkr.monitor_item_id = ${parseInt(monitorItemId)}`;
    }

    // 获取排名数据
    const query = `
      SELECT 
        mkr.id,
        mkr.keyword,
        mkr.rank_position,
        mkr.page,
        mkr.captured_at,
        ms.ozon_product_id,
        ms.product_title
      FROM monitor_keyword_rankings mkr
      LEFT JOIN monitor_items mi ON mkr.monitor_item_id = mi.id
      LEFT JOIN market_signals ms ON mi.signal_id = ms.id
      ${whereClause}
      ORDER BY mkr.captured_at ASC
    `;

    const result = await db.execute(sql`${sql.raw(query)}`);
    const rows = (result as any).rows || [];

    // 按日期聚合
    const dailyMap = new Map<string, any>();
    
    rows.forEach((record: any) => {
      const date = new Date(record.captured_at).toISOString().split('T')[0];
      
      if (!dailyMap.has(date)) {
        dailyMap.set(date, {
          date,
          ranks: [],
          avgRank: null,
          bestRank: null,
          worstRank: null,
          dataPoints: 0
        });
      }
      
      const dayData = dailyMap.get(date)!;
      dayData.dataPoints++;
      
      if (record.rank_position !== null) {
        dayData.ranks.push(record.rank_position);
      }
    });

    // 计算每日统计
    const trend = [];
    for (const [, dayData] of dailyMap) {
      const ranks = dayData.ranks as number[];
      
      if (ranks.length > 0) {
        const avgRank = ranks.reduce((a: number, b: number) => a + b, 0) / ranks.length;
        dayData.avgRank = Math.round(avgRank * 10) / 10;
        dayData.bestRank = Math.min(...ranks);
        dayData.worstRank = Math.max(...ranks);
      }
      
      delete dayData.ranks;
      trend.push(dayData);
    }

    // 按日期排序
    trend.sort((a: any, b: any) => a.date.localeCompare(b.date));

    // 计算总体统计
    const allRanks = rows
      .filter((r: any) => r.rank_position !== null)
      .map((r: any) => r.rank_position);
    
    const overallStats = {
      totalDataPoints: rows.length,
      daysWithData: trend.length,
      overallAvgRank: allRanks.length > 0 
        ? Math.round((allRanks.reduce((a: number, b: number) => a + b, 0) / allRanks.length) * 10) / 10
        : null,
      bestRank: allRanks.length > 0 ? Math.min(...allRanks) : null,
      worstRank: allRanks.length > 0 ? Math.max(...allRanks) : null,
      currentRank: allRanks.length > 0 ? allRanks[allRanks.length - 1] : null,
      rankChange: allRanks.length >= 2 
        ? allRanks[0] - allRanks[allRanks.length - 1] 
        : null // 正数表示进步
    };

    // 获取相关关键词
    const relatedQuery = `
      SELECT DISTINCT keyword
      FROM monitor_keyword_rankings
      WHERE LOWER(keyword) LIKE LOWER('%${keyword}%')
        AND keyword != '${keyword}'
        AND captured_at >= '${startDate.toISOString()}'
      LIMIT 10
    `;

    const relatedResult = await db.execute(sql`${sql.raw(relatedQuery)}`);
    const relatedRows = (relatedResult as any).rows || [];
    const relatedKeywords = relatedRows.map((r: any) => r.keyword);

    return NextResponse.json({
      success: true,
      keyword,
      days,
      trend,
      stats: overallStats,
      relatedKeywords
    });
  } catch (error) {
    console.error('获取排名趋势失败:', error);
    return NextResponse.json({ error: '服务器异常' }, { status: 500 });
  }
}
