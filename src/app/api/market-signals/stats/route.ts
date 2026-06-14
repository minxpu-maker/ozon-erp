/**
 * 采集统计API
 * GET /api/market-signals/stats - 获取采集统计数据
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, marketSignals } from '@/storage/database/shared/schema';
import { sql, desc, gte, and } from 'drizzle-orm';

// 获取今天开始时间戳
function getTodayStart(): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

// 获取本周开始时间戳
function getWeekStart(): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // 周一
  now.setDate(diff);
  now.setHours(0, 0, 0, 0);
  return now;
}

export async function GET(request: NextRequest) {
  try {
    const todayStart = getTodayStart();
    const weekStart = getWeekStart();
    const todayStartTs = Math.floor(todayStart.getTime() / 1000);
    const weekStartTs = Math.floor(weekStart.getTime() / 1000);

    // 查询统计数据
    const stats = await db
      .select({
        todayCount: sql<number>`count(*) filter (where ${marketSignals.createdAt} >= ${todayStartTs})`,
        weekCount: sql<number>`count(*) filter (where ${marketSignals.createdAt} >= ${weekStartTs})`,
        totalCount: sql<number>`count(*)`,
      })
      .from(marketSignals)
      .limit(1);

    // 查询最近采集的信号（用于获取待认领/已认领/已发布状态）
    // 注意：这里假设有status字段，如果schema没有需要先添加
    // 暂时返回0，后续可以根据实际需求添加状态统计
    const recentSignals = await db
      .select({
        count: sql<number>`count(*)`,
      })
      .from(marketSignals)
      .where(gte(marketSignals.createdAt, weekStartTs))
      .limit(1);

    const result = {
      success: true,
      data: {
        todayCollect: stats[0]?.todayCount || 0,
        weekCollect: stats[0]?.weekCount || 0,
        totalCollect: stats[0]?.totalCount || 0,
        pending: 0,  // 待认领数量（需要status字段支持）
        claimed: 0,  // 已认领数量（需要status字段支持）
        published: 0, // 已发布数量（需要status字段支持）
      }
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Stats API] Error:', error);
    return NextResponse.json(
      { success: false, error: '获取统计数据失败' },
      { status: 500 }
    );
  }
}
